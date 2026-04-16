import winston from "winston";

/**
 * Strip verbose HTTP/TLS internals from axios errors before they hit the log.
 * Axios errors carry the entire request agent (sockets, TLS certs, buffers)
 * which produces thousands of lines of noise when serialised.
 */
const sanitizeAxios = winston.format((info: any) => {
  // Detect axios error properties spread onto the info object
  if (info.isAxiosError || info.config?.httpsAgent || info.request?._header) {
    const clean: Record<string, any> = {
      level: info.level,
      message: info.message,
      timestamp: info.timestamp,
      stack: info.stack,
    };
    if (info.response) {
      clean.status = info.response.status;
      clean.statusText = info.response.statusText;
      clean.data = info.response.data;
    }
    if (info.config) {
      clean.url = info.config.url;
      clean.method = info.config.method;
    }
    return clean;
  }

  // Also catch raw Error objects passed as splat / meta
  for (const key of Object.keys(info)) {
    const val = info[key];
    if (val && typeof val === "object" && (val.isAxiosError || val.config?.httpsAgent)) {
      info[key] = {
        message: val.message,
        status: val.response?.status,
        data: val.response?.data,
        url: val.config?.url,
        method: val.config?.method,
      };
    }
  }

  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    sanitizeAxios(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

export default logger;
