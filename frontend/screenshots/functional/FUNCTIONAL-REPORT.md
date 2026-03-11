# EventAlbum Functional Audit

**Date:** 2026-03-10T07:18:52.386Z
**Passed:** 55/55
**Failed:** 0/55

| # | Status | Test | Detail |
|---|--------|------|--------|
| 1 | PASS | getEvent (host) | title="Test UX Review", tier=basic |
| 2 | PASS | getStats | uploads=18/150, guests=2 |
| 3 | PASS | getStorage | totalBytes=4442206 |
| 4 | PASS | getQrStats | scans=0, unique=0 |
| 5 | PASS | listMedia | count=5, total=undefined |
| 6 | PASS | searchMedia | results=0 |
| 7 | PASS | updateEvent (description, welcome, footer, location) | status=200 |
| 8 | PASS | updateEvent (schedule) | status=200 |
| 9 | PASS | updateEvent persistence check | location=true, schedule=true, welcome=true |
| 10 | PASS | updateSettings | status=200 |
| 11 | PASS | getConfig (public) | tiers=basic,paid,premium |
| 12 | PASS | getActivity | status=200 |
| 13 | PASS | getEvent (public/unauthenticated) | title="Anthony", hasHostEmail=false |
| 14 | PASS | authEvent (guest, no password) | role=undefined, nickname=undefined, verified=undefined |
| 15 | PASS | authEvent (wrong password) | code=WRONG_PASSWORD |
| 16 | PASS | authEvent (correct password) | ok=true |
| 17 | PASS | listMedia (guest, visible only) | count=5, allVisible=true |
| 18 | PASS | addReaction (unverified guest — should fail) | status=403, code=OTP_REQUIRED |
| 19 | PASS | addComment (unverified guest — should fail) | status=403, code=OTP_REQUIRED |
| 20 | PASS | addComment (host) | commentId=cmt_DZij3i34EN8qkiQt, status=visible |
| 21 | PASS | listComments | count=3 |
| 22 | PASS | addReaction (host) | status=200 |
| 23 | PASS | autoApprove current value | autoApprove=false, tier=paid |
| 24 | PASS | updateSettings (autoApprove=false, paid tier) | status=200, expected=ok |
| 25 | PASS | autoApprove current state | autoApprove=false |
| 26 | PASS | updateSettings (allowDownloads=true, paid tier) | status=200 |
| 27 | PASS | listMedia (pending_review filter) | count=0 |
| 28 | PASS | moderateMedia (approve) | No pending items to moderate (expected for autoApprove=true) |
| 29 | PASS | getUploadUrl (host) | mediaId=med_131abba0747a48c0b6934d229ce68402, hasUrl=true |
| 30 | PASS | getUploadUrl (cover, host only) | hasUrl=true |
| 31 | PASS | getUploadUrl (unverified guest — should fail) | status=403, code=OTP_REQUIRED |
| 32 | PASS | reportMedia (unverified guest — should fail) | status=403, code=OTP_REQUIRED |
| 33 | PASS | downloadZip (host, paid tier) | fileCount=5, estimatedSize=2353531 |
| 34 | PASS | validatePromo (valid staging code) | valid=true, discount=undefined |
| 35 | PASS | validatePromo (invalid code) | valid=false, message=undefined |
| 36 | PASS | Dashboard renders stats + actions | hasPhotos=true, hasActions=true |
| 37 | PASS | Dashboard shows recent photos | photoCount=6 |
| 38 | PASS | Click photo opens media view | url=https://d1s9zkxvf49wr6.cloudfront.net/e/evt_sNT94rwbcViC/media/med_131abba0747a48c0b6934d229ce68402 |
| 39 | PASS | Close media returns to admin (not guest gallery) | url=https://d1s9zkxvf49wr6.cloudfront.net/e/evt_sNT94rwbcViC/admin |
| 40 | PASS | Edit: textarea keeps focus after typing | activeElement=TEXTAREA |
| 41 | PASS | Edit: save changes | hasError=false |
| 42 | PASS | Settings: found toggles | count=14 |
| 43 | PASS | Settings: toggle clicked and reverted | OK |
| 44 | PASS | QR page: correct staging URL (not prod) | hasStagingUrl=true, hasProdUrl=false |
| 45 | PASS | Gallery manage: shows uploaded content | hasElements=true |
| 46 | PASS | Moderation: Pendientes tab clicked | OK |
| 47 | PASS | Moderation: Reportados tab clicked | OK |
| 48 | PASS | Guest: entered event → gallery | url=https://d1s9zkxvf49wr6.cloudfront.net/e/evt_PS-u3__aILAD/gallery |
| 49 | PASS | Guest gallery: shows photos | count=5 |
| 50 | PASS | Guest: header back button clicked | url=https://d1s9zkxvf49wr6.cloudfront.net/e/evt_PS-u3__aILAD/gallery |
| 51 | PASS | Guest: click photo → media view | url=https://d1s9zkxvf49wr6.cloudfront.net/e/evt_PS-u3__aILAD/media/med_7c934762c9b748039183cd0ae89d043e |
| 52 | PASS | Media view: reaction buttons visible | count=3 |
| 53 | PASS | Media view: comment button visible | visible=true |
| 54 | PASS | Media view: comments sheet opens | OK |
| 55 | PASS | Guest: close media → back to gallery | url=https://d1s9zkxvf49wr6.cloudfront.net/e/evt_PS-u3__aILAD/gallery |