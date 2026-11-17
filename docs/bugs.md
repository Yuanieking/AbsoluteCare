## **Extracted Bug Report**

| Bug ID  | Mission / Module                                  | Bug Title                                                     |
| ------- | ------------------------------------------------- | ------------------------------------------------------------- |
| BUG-001 | Mission 1: Patient Portal                         | Continuing of filling in to create an account                 |
| BUG-002 | Mission 1: Booking Appointments                   | Appointment can be scheduled even if its beyond working hours |
| BUG-003 | Mission 2: Google Calendar                        | Google calendar not syncing                                   |
| BUG-004 | Mission 3: Setting Working Days & Hours           | Uncustomizable availability scheduling                        |
| BUG-005 | Mission 3: Requesting Reschedules & Calendar Sync | Rescheduling wont reflect in the google calendar              |
| BUG-006 | Mission 4: Updating Existing Session Records      | Editing therapy services by putting minimum therapy duration  |

### **Complete Bug Details**

#### **BUG-001 — Patient Portal**

**Bug Title:** Continuing of filling in to create an account

**Steps to Reproduce:**

1. Sign up.
2. Click terms of condition.
3. After agreeing, the user can then proceed to the login page using his/her created account.

**Expected Result:**\
Terms and condition should be visible inside the sign-up page for easy access and continuous account creation.

**Actual Result:**\
The terms and condition was placed in a different page and when the user goes back, his/her progress gets reset.

**Severity:** High\
**Status:** Open

#### **BUG-002 — Booking Appointments**

**Bug Title:** Appointment can be scheduled even if it's beyond working hours.

**Steps to Reproduce:**

1. Open Book Appointment.
2. Choose a therapy service, date, and time.
3. Request appointment beyond working hours.

**Expected Result:**\
The booking hours should only be specified within the allowed working hours. It should not accept any booking appointments beyond that.

**Actual Result:**\
The user was able to schedule an appointment beyond working hours.

**Severity:** High\
**Status:** Open

#### **BUG-003 — Google Calendar**

**Bug Title:** Google calendar not syncing

**Steps to Reproduce:**

1. Submit an appointment.
2. Add to Google Calendar then submit.
3. Check Google Calendar.

**Expected Result:**\
The booked appointment should appear in the Google Calendar.

**Actual Result:**\
The booked appointment didn't show inside the Google Calendar after adding it in the appointment section.

**Severity:** High\
**Status:** Open

#### **BUG-004 — Setting Working Days & Hours**

**Bug Title:** Uncustomizable availability scheduling

**Steps to Reproduce:**

1. Login as therapist.
2. Navigate availability page.
3. Schedule availability based on date and time.

**Expected Result:**\
Able to create availability based on the chosen day of the month and time of the day.

**Actual Result:**\
The user cannot create/customize availability schedule.

**Severity:** High\
**Status:** Open

#### **BUG-005 — Requesting Reschedules & Calendar Sync**

**Bug Title:** Rescheduling wont reflect in the google calendar

**Steps to Reproduce:**

1. Navigate to the My Appointments.
2. Request for a reschedule based on the next availability then submit.
3. Then check Google Calendar.

**Expected Result:**\
The newly rescheduled appointment availability should reflect on the Google Calendar.

**Actual Result:**\
The rescheduled appointment wouldn't show up in the Google Calendar.

**Severity:** High\
**Status:** Open

#### **BUG-006 — Updating Existing Session Records**

**Bug Title:** Editing therapy services by putting minimum therapy duration

**Steps to Reproduce:**

1. Navigate to the therapy services page.
2. Edit a client therapy duration.
3. Then put the lowest minimum duration to see if it has a duration requirement.

**Expected Result:**\
The time duration should have a minimum requirement since there are no sessions that would only last a minute.

**Actual Result:**\
The system allowed the therapist to set a duration that isn't considered a realistic approach.

**Severity:** High\
**Status:** Open

Note: The screenshot also shows the beginning of BUG-007, but its details are cut off, so it was not included.