# WeSupport User Guide

## 🎯 Overview

WeSupport is a unified dashboard that brings together all your support tools in one place:
- **Front** for support tickets
- **Intercom** for customer questions
- **Luciq** for bug tracking
- Coming soon: **Retool** for user management

No more switching between tabs! Find everything in one search.

---

## 🔍 How to Use the Dashboard

### Main Search Screen

When you open WeSupport, you'll see:
1. **Search Box** at the top
2. **Integration Status** panel on the right
3. **Results Area** (starts empty)

### Step 1: Choose Search Type

You can search by:
- **Email Address** (e.g., user@company.com)
- **User ID** (e.g., 12345)

Select which one using the radio buttons.

### Step 2: Enter Your Query

Type in the email or user ID you want to find.

Example:
```
Email: john.doe@company.com
OR
User ID: user_123456
```

### Step 3: Click Search

Click the **Search** button.

The system will immediately search:
- 📧 **Front** contacts
- 💬 **Intercom** contacts  
- 🐛 **Luciq** bugs

---

## 📊 Understanding Results

### Results Tabs

Once search completes, you'll see a tabbed interface:

| Tab | Shows | Icon |
|-----|-------|------|
| **All Results** | Everything from all tools | 📋 |
| **Front** | Support tickets & contact info | 📧 |
| **Intercom** | Questions & conversations | 💬 |
| **Luciq** | Related bugs & issues | 🐛 |

Each tab shows a count of matches: `Front (2)`, `Intercom (5)`, etc.

### Result Cards

Each result displays:
- **Name or Title** - Contact name or bug title
- **ID/Email** - Contact email or bug ID
- **Status** - Active, open, closed, etc.
- **View Details** button - Click to see more info

Example:
```
John Doe
john.doe@company.com
Status: Active

[View Details]
```

---

## 🟢 Integration Status Panel

On the right sidebar, you'll see status for each platform:

### What the indicators mean:

🟢 **Green dot** = Connected and syncing  
🔴 **Red dot** = Connection error  

### Information shown:
- **Status** - success, failed, or pending
- **Last sync** - When data was last updated
- **Message** - Any error details

#### Example:
```
📧 Front
Status: success
Last sync: 12:05 PM
```

---

## ⏱️ How Often Data Updates

The system automatically syncs with all platforms **every 5 minutes**.

- If data changes in Front/Intercom, you'll see it within 5 minutes
- Search results are cached for instant repeat searches
- Sync status is logged for monitoring

---

## 💡 Tips & Tricks

### Faster Searches

**First search:** Takes 2-5 seconds (live query)  
**Same search again:** Instant (cached)

The system remembers recent searches!

### Email vs User ID

Not sure which to use?

- **Use Email if:** You have the customer's email
- **Use User ID if:** You have their account/user ID
- **Have both?** Either works!

### Multiple Results

If someone appears in multiple tools:
- View in each tab separately
- "All Results" shows everything at once
- Each platform may have different data

---

## 📱 Common Use Cases

### Case 1: Customer Complains About a Bug

1. Customer emails: "I found a bug!"
2. You get their email from the message
3. Search by email in WeSupport
4. See Front ticket, Intercom conversation, AND Luciq bugs
5. All context in one place!

### Case 2: Find User by ID

1. You have a user ID: `user_6789`
2. Switch to "Search by User ID"
3. Paste the ID
4. See all their activity across platforms

### Case 3: Check Integration Health

1. Look at right sidebar
2. See which tools are syncing
3. If red 🔴 - check error message
4. Report to team if tools are down

---

## 🚀 Future Features Coming Soon

- ✨ **User Deletion** - Delete users directly from dashboard
- ✨ **Advanced Filtering** - Filter by date, status, severity
- ✨ **Saved Searches** - Save common searches
- ✨ **Bulk Operations** - Action on multiple users
- ✨ **Real-time Updates** - See changes instantly

---

## ❓ FAQ

### Q: Why is search slow?
**A:** First search queries live APIs (2-5 sec). Same search is cached for instant results.

### Q: Why is data not showing?
**A:** 
- Check integration status panel for red dots
- Make sure the platform has data for that email/ID
- Try a different search after 5 minutes

### Q: Can I delete users from here?
**A:** Not yet! That's coming in the next update. For now, you'll need to use Retool.

### Q: How often is data updated?
**A:** Every 5 minutes automatically. Manual refresh coming soon.

### Q: What if a tool goes down?
**A:** You'll see a red indicator in the Integration Status panel. Other tools keep working.

### Q: Can I export results?
**A:** Feature coming soon! For now, you can screenshot or copy from each result.

---

## 🔧 Troubleshooting

### Search not working?
1. Check internet connection
2. Check that backend is running
3. Try refreshing the page
4. Check browser console for errors (F12)

### Results not showing?
1. Verify the email/ID exists in that platform
2. Check integration status - is it 🟢 green?
3. Try searching again in 5 minutes
4. Try a different search term

### Seeing errors?
- Screenshot the error
- Note the search term you used
- Tell team: check `backend/error.log`

---

## 📞 Need Help?

1. **Dashboard not loading?** - Restart browser
2. **Still not working?** - Check backend is running
3. **Bug to report?** - Create issue with: search term, expected result, actual result
4. **Feature request?** - Add to team roadmap

---

## 🎓 Quick Reference

| Task | Steps |
|------|-------|
| Search by email | Select "Email" → Type email → Click Search |
| Search by ID | Select "User ID" → Type ID → Click Search |
| Switch tools | Click tab (Front, Intercom, Luciq) |
| Check status | Look at right sidebar |
| See all results | Click "All Results" tab |
| Refresh status | Sidebar updates every 30 sec |

---

## ✅ You're Ready!

You now know how to:
- ✅ Search for users/issues
- ✅ View results from all platforms
- ✅ Check integration health
- ✅ Understand sync frequency

**Happy supporting!** 🎉

Questions? The Built Summary or API Setup Guide have more technical details.
