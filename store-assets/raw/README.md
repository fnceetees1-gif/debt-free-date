# raw/ — original screenshots, straight off the device

Drop the untouched device captures here. **Do not paste screenshots into chat
for this purpose** — the chat resizes anything pasted to about 924×2000 WebP,
which Apple and Google both reject. They have to arrive as files.

Ways to get them off an iPhone onto this PC:

- **USB cable** → the Apple Devices app, or File Explorer → Apple iPhone → DCIM
- **Email them to yourself** and download the attachments — simplest
- **iCloud.com → Photos → select → Download**

## What is needed

Captured on a build that includes the cleared-debt fix (commit `7565459`), with
believable demo data loaded:

| # | screen | note |
| --- | --- | --- |
| 1 | Dashboard | **scrolled to the top** — the DEBT-FREE DATE hero is the frame that appears in search results |
| 2 | Strategy | with data where snowball and avalanche actually differ |
| 3 | Progress | scrolled to the top |
| 4 | Debts | |
| 5 | Log payment | the sheet open |
| 6 | Settings | same session as the rest |

## Demo data that makes the app look like itself

The Oct 19 captures showed "Both strategies cost you the same here", because the
smallest balance was also the highest rate. That frame is meant to sell the
snowball/avalanche comparison, so the data has to make them diverge:

```
Visa          $2,400   24.99%   min $75
Store card    $1,150   26.99%   min $40
Car loan     $12,800    6.40%   min $310
Student loan  $9,300    5.80%   min $180
extra payment $150
```

Avoid round-number test data and single huge payments. The live 1.0 screenshots
got this right by accident — $31,460 of debt, May 2029, $885 minimums — and that
is the register to aim for.

## Accepted sizes

- **App Store**, 6.9" primary: 1320×2868 or 1290×2796, PNG or JPEG, no alpha
- **Google Play**: 9:16, minimum 1080×1920, PNG or JPEG

A native iPhone capture is already the right pixel size; it only needs to stay
unresized and in PNG or JPEG.
