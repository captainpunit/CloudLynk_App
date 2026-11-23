# What we need from you, step by step

To finish CloudLynk we need access to your Google Play and Meta accounts. You do not need
to copy any keys or passwords. The safest way is to **invite our developer** into each
account; we then create the keys ourselves and store them only on the server.

Please use the developer email we give you for every invitation below.

**Please never send passwords, keys or JSON files by WhatsApp, email or chat.** If you
must send a file, use a sharing link that expires (for example Bitwarden Send or
1Password) and tell us the password by phone.

---

## Part 1. Google Play (needed for the app to be on the Play Store)

### 1.1 Create the developer account (skip if you have one)

1. Open <https://play.google.com/console/signup> with the Google account the business
   will own.
2. Choose **Organisation** if the business has a D-U-N-S number, otherwise **Yourself**.
   A personal account must test the app with 12 people for 14 days before it can go
   public; an organisation account does not.
3. Pay the one-time fee of US$25 and complete the identity check. Google can take a few
   days to approve it.

### 1.2 Invite our developer

1. In Play Console, open **Users and permissions** (left menu).
2. Click **Invite new users** and enter our developer email.
3. Under **Account permissions**, tick:
   - View app information and download bulk reports
   - Create, edit and delete draft apps
   - Release apps to testing tracks
   - Manage store presence
   - View financial data, orders and cancellation survey responses
   - Manage orders and subscriptions
4. Click **Invite user**. We will accept the invitation from our side.

### 1.3 Turn on alternative billing (UPI next to Google Play)

This lets members choose UPI or Google Play when they pay. Only the account owner can do
it.

1. In Play Console, open **Settings**, then **Monetisation setup** (or **Payments
   profile**) and complete the payments profile with the business bank details.
2. Then go to **Alternative billing** (under Settings) and enrol for **India** in
   *user choice billing*. Google asks you to accept its terms and confirm the business
   follows card-security rules (PCI DSS) and has a way for users to report fraud.
3. Tell us when Google confirms the enrolment.

### 1.4 The service account (we do this once we are invited)

The server needs a "service account" to check Google Play purchases. If you invite us as
in 1.2 **and** add us to the Google Cloud project as in 1.5, we create it ourselves and
you do nothing more.

### 1.5 Google Cloud (needed: purchase checks and purchase notifications)

1. Open <https://console.cloud.google.com> with the same business Google account.
2. Create a project named **CloudLynk** (top bar, project list, **New project**).
3. Open **IAM and admin**, then **IAM**, click **Grant access**, enter our developer
   email and choose the role **Editor**. Save.

With this access we also connect Google Play's purchase notifications (Pub/Sub). They
make sure a plan bought with Google Play is granted even when the app closes during
payment or a payment clears later; Google refunds anything not granted within three
days. You do nothing more for this.

> If you prefer to do the service account yourself instead: in that project open **IAM and admin**,
> **Service accounts**, **Create service account**, name it `play-billing`, finish, open
> it, **Keys**, **Add key**, **JSON**. A file downloads. Then in Play Console, **Users and
> permissions**, invite the service account's email (it ends in
> `iam.gserviceaccount.com`) with the two permissions *View financial data* and *Manage
> orders and subscriptions*. Share the JSON file only through an expiring link.

### 1.6 The five plans as Play products (we can do this once invited)

In Play Console, the app, **Monetise**, **Products**, **In-app products**, create these
five with exactly these IDs and prices:

| Product ID | Name | Price |
| --- | --- | --- |
| `trial` | Trial, 2 days | ₹69 |
| `silver` | Silver, 7 days | ₹129 |
| `gold` | Gold, 1 month | ₹259 |
| `platinum` | Platinum, 6 months | ₹599 |
| `diamond` | Diamond, 1 year | ₹999 |

---

## Part 2. Meta (needed to know which adverts bring paying members)

### 2.1 Business account and app (skip what you already have)

1. Open <https://business.facebook.com> and create a business portfolio for the company.
2. Open <https://developers.facebook.com/apps>, **Create app**, type **Business**, name
   it **CloudLynk**, and connect it to the business portfolio.

### 2.2 The dataset (pixel)

1. Open **Events Manager** (<https://business.facebook.com/events_manager>).
2. Click **Connect data sources**, choose **App**, select the CloudLynk app, finish.
   This creates a **dataset**. Its number (the **Dataset ID**) is shown under its name.
   The Dataset ID is not secret; you can send it to us.

### 2.3 Invite our developer

1. In **Business settings** (<https://business.facebook.com/settings>), open **Users**,
   **People**, **Add**, enter our developer email, choose **Employee access**.
2. On the next screen give access to:
   - **Apps**: CloudLynk, with *Develop app* (full control)
   - **Datasets** (or Pixels): the CloudLynk dataset, with *Manage dataset*
3. Send the invitation. We will create the Conversions API token ourselves.

> If you prefer to create the token yourself: in Events Manager open the dataset,
> **Settings**, scroll to **Conversions API**, click **Generate access token**, and share
> it only through an expiring link. The token is shown once.

### 2.4 Two values for the app build (not secret)

From <https://developers.facebook.com/apps>, open the CloudLynk app:

- **App ID**: shown at the top of the dashboard.
- **Client token**: **App settings**, **Advanced**, **Security**, **Client token**.

You can send these two values by message; they are built into the app anyway.

---

## Part 3. Business details (send by message)

- Merchant (business) UPI ID and the payee name the bank shows. A personal UPI ID is
  usually limited or blocked for app payments.
- Is the business GST-registered, and is the GST rate included in the prices 18%?
- Legal business name, address, support email, support phone.
- Name of the grievance officer (required by Indian IT rules).
- The email of the first administrator of the app.
- The website domain where the privacy policy, terms and account deletion pages will go.
- App icon (512×512 px), a banner (1024×500 px) and, if you have them, phone screenshots.

---

## What you do **not** need to send

- Any password.
- The Meta Graph API version or test event code: we choose these ourselves.

## Checklist to send back to us

- [ ] Play Console: our developer invited (1.2)
- [ ] Play Console: alternative billing enrolment requested (1.3)
- [ ] Google Cloud: our developer added as Editor (1.5)
- [ ] Meta: our developer invited to the business with the app and dataset (2.3)
- [ ] Meta: App ID, client token and Dataset ID sent (2.2, 2.4)
- [ ] Business details sent (Part 3)
