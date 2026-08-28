# HAMLA

BUILD A COMPLETE HAMLA DONATION / CROWDFUNDING PAGE.

The attached screenshots are the visual reference for the campaign page.

I want the HAMLA donation page to have essentially the SAME INFORMATION ARCHITECTURE, SPACING, CONTENT HIERARCHY, and UX pattern as the GoFundMe campaign pages shown in the reference screenshots.

IMPORTANT:

Do NOT copy GoFundMe branding, logo, proprietary assets, or text.

Do NOT use the GoFundMe name anywhere in the application.

Instead, recreate the same type of crowdfunding experience using the HAMLA brand, HAMLA logo, HAMLA colors, and original UI styling.

The result should look like a serious, established crowdfunding platform rather than a generic SaaS dashboard.

==================================================

HAMLA BRAND

==================================================

Platform:

HAMLA

Arabic:

حملة

Use the provided HAMLA logo as the official logo.

The platform is primarily intended for Algeria.

Primary language:

Arabic

The entire interface must support RTL correctly.

Use:

IBM Plex Sans Arabic

Use the following design system:

--background: rgb(252, 252, 252);

--foreground: rgb(23, 23, 23);

--card: rgb(252, 252, 252);

--card-foreground: rgb(23, 23, 23);

--popover: rgb(252, 252, 252);

--popover-foreground: rgb(82, 82, 82);

--primary: rgb(114, 227, 173);

--primary-foreground: rgb(30, 39, 35);

--secondary: rgb(253, 253, 253);

--secondary-foreground: rgb(23, 23, 23);

--muted: rgb(237, 237, 237);

--muted-foreground: rgb(32, 32, 32);

--accent: rgb(237, 237, 237);

--accent-foreground: rgb(32, 32, 32);

--destructive: rgb(202, 50, 20);

--destructive-foreground: rgb(255, 252, 252);

--border: rgb(223, 223, 223);

--input: rgb(246, 246, 246);

--ring: rgb(114, 227, 173);

Font:

IBM Plex Sans Arabic

Border radius:

0.5rem

Overall aesthetic:

- White / off-white background

- Clean

- Minimal

- Trustworthy

- Human

- Professional

- Generous whitespace

- Thin light-gray borders

- Subtle shadows

- Green HAMLA accent

- Orange/yellow secondary CTA where appropriate

- No excessive gradients

- No glassmorphism

- No futuristic/crypto styling

==================================================

1. DESKTOP CAMPAIGN PAGE

==================================================

Create a campaign page with the following structure.

The page should visually follow this hierarchy:

--------------------------------------------------

TOP NAVIGATION

--------------------------------------------------

Create a slim horizontal navigation bar.

Desktop:

LEFT:

- HAMLA logo

- Search icon + "بحث"

- "كيف تعمل؟"

- Optional navigation links

CENTER:

- HAMLA logo if the layout requires centered branding

RIGHT:

- "تسجيل الدخول"

- "إنشاء حملة"

- Primary "تبرع الآن" button

The navbar should remain clean and compact.

Use a white background with a subtle bottom border.

On mobile:

- HAMLA logo

- Menu button

- Compact donation CTA

==================================================

2. CAMPAIGN CONTAINER

==================================================

The main campaign content should use a centered max-width container.

Desktop layout:

              CAMPAIGN TITLE

                     |

       ------------------------------

       |                            |

       |                            |

 MAIN CONTENT                  DONATION CARD

 ~65%                          ~35%

       |                            |

       |                            |

       ------------------------------

The page should NOT look like a dashboard.

It should look like a public fundraising campaign.

Maximum content width:

approximately 1180–1250px.

Main content:

approximately 65–68%

Right donation card:

approximately 32–35%

Use a generous gap between both columns.

==================================================

3. CAMPAIGN TITLE

==================================================

At the top of the campaign:

Large bold campaign title.

Example:

"ساعدوا عائلة أحمد على تجاوز محنتهم"

The title should be visually prominent but not enormous.

Below the title:

Optional campaign category / verification indicator.

Example:

"حملة موثقة"

Use a small badge with a subtle green treatment.

==================================================

4. MAIN CAMPAIGN IMAGE

==================================================

Under the title, display the campaign's main image.

The image should:

- Be large

- Have approximately 16:9 proportions

- Have rounded corners

- Occupy almost the entire main-content width

- Use object-fit: cover

- Look like a professional fundraising campaign hero image

Example desktop dimensions:

approximately 650–700px wide.

Do NOT put text over the image.

Do NOT use a carousel unless multiple campaign images are specifically provided.

==================================================

5. ORGANIZER INFORMATION

==================================================

Directly underneath the campaign image create an organizer row.

Example:

[avatar]

"محمد بن علي ينظم هذه الحملة."

or:

"هذه الحملة ينظمها محمد بن علي."

Include:

- Organizer avatar

- Organizer name

- Verification indicator when applicable

- Relationship to beneficiary if provided

Example:

"سارة بن أحمد تنظم هذه الحملة لمساعدة والدتها."

Use a simple horizontal layout.

==================================================

6. TRUST / VERIFICATION

==================================================

Below the organizer section, add a subtle divider.

Then a trust badge:

✓ حملة موثقة

or:

🛡 التبرعات محمية

Keep this visually subtle.

Do NOT make it look like a fake government certification.

Only display verification if the campaign actually has a verified status.

==================================================

7. CAMPAIGN STORY

==================================================

Below the trust section, display the campaign description/story.

Use large readable Arabic typography.

Example:

"نطلب منكم مساعدتنا في تجاوز هذه الظروف..."

The story should support:

- Paragraphs

- Headings

- Lists

- Links where appropriate

- Images if provided

Use approximately 17–18px body text on desktop.

Line height should be generous.

The campaign story should feel editorial rather than like a form.

==================================================

8. DONATION CARD — CRITICAL

==================================================

This is the most important part of the page.

Create a sticky donation card on desktop.

The card should visually resemble the donation panel shown in the reference screenshots:

White card

Rounded corners

Subtle shadow

Light border

Position:

sticky

Top offset:

approximately 24px

The card should remain visible while the user scrolls through the campaign story.

==================================================

DONATION CARD STRUCTURE

==================================================

TOP:

Amount raised:

"2,715 دج تم جمعها"

or dynamically:

"1,250,000 دج تم جمعها"

Underneath:

"من أصل 3,500,000 دج"

Then:

"44 تبرع"

Example:

2,715 دج تم جمعها

من أصل 3,500 دج

44 تبرع

==================================================

9. PROGRESS BAR

==================================================

Display a clear fundraising progress bar.

Example:

████████████░░░░

78%

Use HAMLA green:

rgb(114, 227, 173)

The progress percentage should be calculated dynamically:

raisedAmount / goalAmount * 100

Do NOT hardcode the percentage.

Also display the percentage in a circular progress indicator if it fits the design.

==================================================

10. SHARE BUTTON

==================================================

Under the progress section:

Secondary button:

"مشاركة"

The share button should support:

- Copy campaign link

- WhatsApp

- Facebook

- X

- Native Web Share API on supported mobile browsers

Use a share icon.

==================================================

11. DONATE NOW BUTTON

==================================================

Immediately underneath:

Large primary CTA:

"تبرع الآن"

This is the main conversion button.

It should be highly visible.

Clicking it opens the donation process.

On mobile, this should become extremely prominent.

==================================================

12. RECENT DONATIONS

==================================================

Under the CTA, show a donation activity section.

Example:

"44 شخصاً تبرعوا لهذه الحملة"

Then list recent donations:

[avatar/icon]

محمد

500 دج

منذ ساعتين

[avatar/icon]

متبرع مجهول

1,000 دج

منذ 5 ساعات

[avatar/icon]

سارة

200 دج

منذ يوم

Show:

- Donor name

- Amount

- Time

- Optional donor message

If donor chooses anonymity:

"متبرع مجهول"

Never expose private donor information without permission.

==================================================

13. TOP DONATIONS

==================================================

Provide:

"أعلى التبرعات"

Show the highest donations.

Example:

متبرع مجهول — 10,000 دج

محمد — 5,000 دج

سارة — 2,000 دج

Provide:

"عرض جميع التبرعات"

button.

==================================================

14. DONATION FLOW

==================================================

When the user clicks:

"تبرع الآن"

start the following flow:

STEP 1 — AUTHENTICATION

Before donating, require the user to:

"تسجيل الدخول أو إنشاء حساب"

Primary option:

"المتابعة باستخدام Google"

Use Google OAuth.

Also provide:

"لدي حساب بالفعل — تسجيل الدخول"

If the user is already authenticated, skip this step.

==================================================

STEP 2 — SELECT DONATION AMOUNT

==================================================

Display:

"اختر مبلغ التبرع"

Quick amount buttons:

500 دج

1,000 دج

2,000 دج

5,000 دج

10,000 دج

Then:

"مبلغ آخر"

with a custom numeric input.

Currency:

DZD / دج

Do NOT allow negative values.

Validate minimum and maximum donation amounts.

Display the selected amount clearly.

Example:

مبلغ التبرع

2,000 دج

==================================================

STEP 3 — DONOR INFORMATION

==================================================

Show the authenticated donor's information.

Name:

automatically populated from Google account where appropriate.

Email:

automatically populated.

Allow:

☐ إظهار التبرع كمجهول

Optional message:

"أضف رسالة إلى الحملة"

The donor can choose whether their name is publicly displayed.

==================================================

STEP 4 — PAYMENT

==================================================

Display:

"الدفع"

The payment method should be designed for an Algerian payment gateway.

IMPORTANT:

Do not fake a payment gateway.

Create a payment-provider abstraction such as:

PaymentProvider

with methods conceptually equivalent to:

createPayment()

getPaymentStatus()

verifyPayment()

handleWebhook()

The implementation must allow the real Algerian payment gateway API credentials to be added securely through environment variables.

Never expose:

- API secret

- merchant secret

- private keys

- payment credentials

to the frontend.

The frontend should communicate with the backend.

The payment flow must support:

1. Create donation record

2. Generate unique transaction/reference ID

3. Create payment request

4. Redirect/open official payment gateway

5. Wait for payment result

6. Verify transaction server-side

7. Mark donation as successful only after server-side verification

8. Generate invoice

9. Show confirmation page

==================================================

15. ALGERIAN PAYMENT GATEWAY

==================================================

Design the integration layer so that the platform can connect to the actual Algerian payment provider.

Do NOT invent API endpoints.

Use environment variables:

PAYMENT_GATEWAY_URL

PAYMENT_MERCHANT_ID

PAYMENT_API_KEY

PAYMENT_SECRET

PAYMENT_CALLBACK_URL

The exact payment provider should be configurable.

Create a clean adapter:

/lib/payments/

For example:

payment-provider.ts

algerian-payment-provider.ts

The rest of the application should not depend directly on a specific gateway.

This allows the gateway to be replaced later without rewriting the donation system.

==================================================

16. PAYMENT STATUS

==================================================

Create clear states:

PENDING

PROCESSING

PAID

FAILED

CANCELLED

REFUNDED

Never mark a donation as PAID based only on frontend state.

Payment success must be verified server-side.

Handle:

- User closes payment window

- Payment timeout

- Failed payment

- Duplicate callback

- Duplicate payment request

- Gateway unavailable

- Network failure

Use idempotency wherever possible.

==================================================

17. SUCCESS PAGE

==================================================

After successful payment:

Display a beautiful confirmation page.

HAMLA logo at the top.

Large success icon.

Title:

"شكراً لك على تبرعك ❤️"

Then:

"تم تسجيل تبرعك بنجاح."

Show:

Donor:

محمد بن أحمد

Amount:

5,000 دج

Campaign:

اسم الحملة

Transaction ID:

HAMLA-2026-XXXXXXXX

Payment status:

تم الدفع

Date:

28 أغسطس 2026

Time:

18:42

Payment method:

Algerian Payment Gateway

==================================================

18. INVOICE / RECEIPT

==================================================

CRITICAL FEATURE.

After successful payment automatically generate a professional donation invoice/receipt.

Label:

"إيصال التبرع"

or:

"Donation Invoice"

The invoice must contain:

HAMLA logo

HAMLA

حملة

--------------------------------

إيصال التبرع

Invoice Number:

HAMLA-INV-XXXXXXXX

Transaction ID:

HAMLA-TXN-XXXXXXXX

Date:

DD/MM/YYYY

Time:

HH:MM

--------------------------------

بيانات المتبرع

اسم المتبرع:

[Donor Name]

البريد الإلكتروني:

[Donor Email]

If anonymous:

اسم المتبرع:

متبرع مجهول

--------------------------------

تفاصيل التبرع

الحملة:

[Campaign Name]

المبلغ:

5,000 دج

حالة الدفع:

مدفوع

طريقة الدفع:

[Payment Gateway]

--------------------------------

المجموع:

5,000 دج

--------------------------------

"شكراً لمساهمتك في دعم هذه الحملة."

The invoice should look like a real professional financial receipt.

Provide buttons:

"تحميل الإيصال PDF"

"طباعة الإيصال"

"إرسال الإيصال إلى البريد الإلكتروني"

PDF generation must happen from the backend or a reliable PDF-generation mechanism.

Do not generate fake invoice numbers.

Invoice numbers must be unique.

==================================================

19. EMAIL RECEIPT

==================================================

After successful payment:

Send the donor a confirmation email containing:

- HAMLA branding

- Campaign name

- Donation amount

- Donor name

- Transaction ID

- Invoice number

- Payment status

- Date/time

- Link to view/download invoice

Email sending should be implemented through a backend email service abstraction.

Do not expose email API credentials to the frontend.

==================================================

20. MOBILE DESIGN

==================================================

On mobile, change the desktop two-column layout into:

Campaign title

Campaign image

Organizer

Verification

Story

Donation information

The donation CTA should remain highly accessible.

Prefer a sticky bottom CTA:

"تبرع الآن"

with the current campaign amount / selected amount where appropriate.

The donation card should become a full-width mobile section rather than a narrow sidebar.

The interface must feel native on mobile.

==================================================

21. CAMPAIGN DATA MODEL

==================================================

Create proper database models.

Campaign:

id

title

slug

description

story

coverImage

goalAmount

raisedAmount

donorCount

category

organizerId

beneficiary

status

verified

createdAt

updatedAt

User:

id

name

email

avatar

googleId

createdAt

Donation:

id

campaignId

userId

amount

currency

donorName

donorEmail

anonymous

message

status

transactionId

paymentProvider

createdAt

updatedAt

Invoice:

id

donationId

invoiceNumber

transactionId

amount

currency

issuedAt

pdfUrl

Payment:

id

donationId

provider

providerTransactionId

status

amount

currency

createdAt

updatedAt

==================================================

22. SECURITY

==================================================

Treat this as a real financial application.

Implement:

- Server-side payment verification

- Authentication protection

- Authorization

- Input validation

- Rate limiting on payment endpoints

- CSRF protection where applicable

- Secure cookies

- Environment variables for secrets

- Webhook signature verification

- Idempotency

- Database transactions

- No client-side trust for payment status

- No sensitive payment credentials in frontend code

- Proper error handling

Never log:

- API secrets

- Payment credentials

- Sensitive authentication tokens

- Full payment card information

==================================================

23. CAMPAIGN PAGE INTERACTIONS

==================================================

Implement:

- Share

- Copy campaign URL

- Donate

- See all donations

- See top donations

- Authentication

- Google sign-in

- Amount selection

- Custom amount

- Anonymous donation

- Payment

- Payment status

- Invoice generation

- PDF download

- Print

- Email receipt

Use smooth, subtle animations.

Do not over-animate.

==================================================

24. EMPTY / ERROR / LOADING STATES

==================================================

Every asynchronous action needs a proper state.

Examples:

Payment loading:

"جاري تحويلك إلى بوابة الدفع..."

Payment verification:

"جاري التحقق من عملية الدفع..."

Failure:

"تعذر إتمام عملية الدفع."

Provide:

"إعادة المحاولة"

Cancelled:

"تم إلغاء عملية الدفع."

Invoice loading:

"جاري إنشاء الإيصال..."

Donation list loading:

Use skeleton loaders.

==================================================

25. EXACT VISUAL PRIORITY

==================================================

The page should visually prioritize:

1. Campaign title

2. Campaign image

3. Donation progress

4. Donate Now CTA

5. Organizer/trust

6. Campaign story

7. Recent donations

The donation card must visually stand out without looking disconnected from the page.

Use a restrained card shadow.

The overall page should have the visual simplicity of a mature crowdfunding platform.

==================================================

26. DO NOT DO THESE THINGS

==================================================

DO NOT:

- Build a generic admin dashboard

- Make the donation page look like a SaaS landing page

- Put the donation form directly on the homepage

- Use huge gradients

- Use neon colors

- Use crypto-style UI

- Use excessive glassmorphism

- Use fake payment APIs

- Pretend a payment succeeded without gateway verification

- Hardcode donation totals

- Hardcode donor lists in production

- Expose API secrets

- Use GoFundMe branding

- Copy GoFundMe logo

- Copy GoFundMe text

- Copy proprietary assets

==================================================

27. FINAL EXPERIENCE

==================================================

The final experience should feel like:

A serious Algerian crowdfunding platform where someone lands on a campaign, understands the story immediately, sees how much has been raised, trusts the organizer, clicks "تبرع الآن", signs in with Google, selects an amount, completes payment through an Algerian payment gateway, and immediately receives a professional HAMLA donation invoice.

The campaign page should closely follow the STRUCTURAL UX shown in the provided GoFundMe screenshots:

- Minimal top navigation

- Large campaign title

- Large campaign image

- Organizer row

- Campaign story on the left

- Sticky fundraising/donation card on the right

- Raised amount

- Goal

- Progress

- Donor count

- Share

- Donate now

- Recent donations

- Top donations

- Responsive mobile version

But the branding, typography, colors, components, copy, icons, and visual identity must belong entirely to HAMLA.

Build the frontend, backend architecture, database schema, authentication flow, donation state machine, payment abstraction, invoice generation, and responsive UI as one coherent production-ready application.

Prioritize visual quality AND correct payment architecture equally.










@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: rgb(252, 252, 252);
    --foreground: rgb(23, 23, 23);
    --card: rgb(252, 252, 252);
    --card-foreground: rgb(23, 23, 23);
    --popover: rgb(252, 252, 252);
    --popover-foreground: rgb(82, 82, 82);
    --primary: rgb(114, 227, 173);
    --primary-foreground: rgb(30, 39, 35);
    --secondary: rgb(253, 253, 253);
    --secondary-foreground: rgb(23, 23, 23);
    --muted: rgb(237, 237, 237);
    --muted-foreground: rgb(32, 32, 32);
    --accent: rgb(237, 237, 237);
    --accent-foreground: rgb(32, 32, 32);
    --destructive: rgb(202, 50, 20);
    --destructive-foreground: rgb(255, 252, 252);
    --border: rgb(223, 223, 223);
    --input: rgb(246, 246, 246);
    --ring: rgb(114, 227, 173);
    --chart-1: rgb(114, 227, 173);
    --chart-2: rgb(59, 130, 246);
    --chart-3: rgb(139, 92, 246);
    --chart-4: rgb(245, 158, 11);
    --chart-5: rgb(16, 185, 129);
    --sidebar: rgb(252, 252, 252);
    --sidebar-foreground: rgb(112, 112, 112);
    --sidebar-primary: rgb(114, 227, 173);
    --sidebar-primary-foreground: rgb(30, 39, 35);
    --sidebar-accent: rgb(237, 237, 237);
    --sidebar-accent-foreground: rgb(32, 32, 32);
    --sidebar-border: rgb(223, 223, 223);
    --sidebar-ring: rgb(114, 227, 173);
    --font-sans: IBM Plex Sans Arabic, ui-sans-serif, sans-serif, system-ui;
    --font-serif: IBM Plex Sans Arabic, ui-sans-serif, sans-serif, system-ui;
    --font-mono: IBM Plex Mono, ui-monospace, monospace;
    --radius: 0.5rem;
    --shadow-x: 0px;
    --shadow-y: 1px;
    --shadow-blur: 3px;
    --shadow-spread: 0px;
    --shadow-opacity: 0.17;
    --shadow-color: #000000;
    --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
    --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
    --shadow-sm: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
    --shadow: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
    --shadow-md: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 2px 4px -1px hsl(0 0% 0% / 0.17);
    --shadow-lg: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 4px 6px -1px hsl(0 0% 0% / 0.17);
    --shadow-xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 8px 10px -1px hsl(0 0% 0% / 0.17);
    --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.43);
    --tracking-normal: 0.025em;
    --spacing: 0.25rem;
  }

  .dark {
    --background: rgb(18, 18, 18);
    --foreground: rgb(226, 232, 240);
    --card: rgb(23, 23, 23);
    --card-foreground: rgb(226, 232, 240);
    --popover: rgb(36, 36, 36);
    --popover-foreground: rgb(169, 169, 169);
    --primary: rgb(0, 98, 57);
    --primary-foreground: rgb(221, 232, 227);
    --secondary: rgb(36, 36, 36);
    --secondary-foreground: rgb(250, 250, 250);
    --muted: rgb(31, 31, 31);
    --muted-foreground: rgb(162, 162, 162);
    --accent: rgb(49, 49, 49);
    --accent-foreground: rgb(250, 250, 250);
    --destructive: rgb(84, 28, 21);
    --destructive-foreground: rgb(237, 233, 232);
    --border: rgb(41, 41, 41);
    --input: rgb(36, 36, 36);
    --ring: rgb(74, 222, 128);
    --chart-1: rgb(74, 222, 128);
    --chart-2: rgb(96, 165, 250);
    --chart-3: rgb(167, 139, 250);
    --chart-4: rgb(251, 191, 36);
    --chart-5: rgb(45, 212, 191);
    --sidebar: rgb(18, 18, 18);
    --sidebar-foreground: rgb(137, 137, 137);
    --sidebar-primary: rgb(0, 98, 57);
    --sidebar-primary-foreground: rgb(221, 232, 227);
    --sidebar-accent: rgb(49, 49, 49);
    --sidebar-accent-foreground: rgb(250, 250, 250);
    --sidebar-border: rgb(41, 41, 41);
    --sidebar-ring: rgb(74, 222, 128);
    --font-sans: IBM Plex Sans Arabic, ui-sans-serif, sans-serif, system-ui;
    --font-serif: IBM Plex Sans Arabic, ui-sans-serif, sans-serif, system-ui;
    --font-mono: IBM Plex Mono, ui-monospace, monospace;
    --radius: 0.5rem;
    --shadow-x: 0px;
    --shadow-y: 1px;
    --shadow-blur: 3px;
    --shadow-spread: 0px;
    --shadow-opacity: 0.17;
    --shadow-color: #000000;
    --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
    --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.09);
    --shadow-sm: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
    --shadow: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 1px 2px -1px hsl(0 0% 0% / 0.17);
    --shadow-md: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 2px 4px -1px hsl(0 0% 0% / 0.17);
    --shadow-lg: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 4px 6px -1px hsl(0 0% 0% / 0.17);
    --shadow-xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.17), 0px 8px 10px -1px hsl(0 0% 0% / 0.17);
    --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.43);
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
} 

GOFUND ME LIKE PLATFORM NAMED HAMLA

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c792d935-0ca0-41c5-aeeb-53cfa19f8d33).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
