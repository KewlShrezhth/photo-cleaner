# Play Store listing

Paste these into Play Console → Grow → Store presence → Main store listing.

**App name** (30 max)
Photo Cleaner

**Short description** (80 max)
Groups your photos into moments and keeps the best shot of each. Nothing deleted.

**Full description** (4000 max)
Took 40 photos at the beach, 10 of dinner and 25 of the dog? Photo Cleaner sorts them for you.

It looks at a day of photos, groups them into moments, and picks the best shot of each one: the sharpest, best-lit photo. You check the picks, tap once, and the extra shots move into an Archive album.

• Finds moments automatically: no sorting, no tagging
• Picks the best 1 to 3 shots per moment, depending on how many you took
• Choose photos by date, by place, or pick them yourself
• Nothing is ever deleted. Extras go to a "Photo Cleaner Archive" album, and photos that fit no moment are left alone
• Private: only small, low-resolution copies are checked, and they are never stored. No account, no ads, no tracking

This is an early demo. Feedback is welcome on GitHub.

**Category:** Photography
**Contact email:** (your email, required by Play Console, shown publicly)
**Privacy policy URL:** https://kewlshrezhth.github.io/photo-cleaner/privacy.html

## Graphics (in this folder)

- `icon-512.png`: app icon, 512×512
- `feature-graphic.png`: banner, 1024×500
- `screenshots/`: phone screenshots, 1080×2400 (Play needs 2 to 8)

## Forms you fill in Play Console

**Data safety**
- Data collected: Photos (App activity → none; Personal info → none)
- Photos: *collected* = yes (sent to the server for processing), *shared* = no, *processed ephemerally* = yes, *required* = yes, purpose = App functionality
- Encrypted in transit: yes (HTTPS server)
- Users can request deletion: not applicable, nothing is stored

**Photo and video permissions declaration** (for READ_MEDIA_IMAGES)
Core purpose: Photo Cleaner is a photo-library organizer. It scans a chosen date range of the user's library, groups similar photos and moves the extra shots into an Archive album, which needs ongoing read access to the whole library and the ability to move files. The Android photo picker returns copies without library access, so the app could not move or archive the originals.

**Content rating:** questionnaire → Utility/Productivity, no objectionable content → Everyone.
**Target audience:** 18+ (keeps the review simple; not designed for children).
**Ads:** No.
