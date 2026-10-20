import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { MONGO_URI } from "../src/config/env.js";
import User from "../src/models/userModel.js";
import Dependent from "../src/models/dependentModel.js";
import TherapyService from "../src/models/therapyServiceModel.js";
import Appointment from "../src/models/appointmentModel.js";
import Session from "../src/models/sessionModel.js";
import Notification from "../src/models/notificationModel.js";

faker.seed(42);
const args = new Set(process.argv.slice(2));
const reset = args.has("--reset");
const minimal = args.has("--minimal");
const yes = args.has("--yes");
const seedPassword = process.env.SEED_PASSWORD || "Password123!";
const requestedPatientCount = Number.parseInt(
  process.argv
    .find((arg) => arg.startsWith("--count-patients="))
    ?.split("=")[1] || (minimal ? "3" : "16"),
  10,
);
const patientCount = minimal
  ? Math.max(3, requestedPatientCount)
  : Math.min(20, Math.max(12, requestedPatientCount));
const SEED_PREFIX = "SEED:";
const seedEmails = /@(absolutecare\.test|student\.buksu\.test|gmail\.test)$/i;
const serviceNames = [
  "Physical Therapy & Rehabilitation",
  "Pediatric Occupational Therapy (Ages 1–18)",
  "Post-operative Rehabilitation",
  "Sports Injury Recovery",
  "Neuro Rehabilitation",
  "Initial Assessment",
  "Pediatric Occupational Therapy (Ages 1–18) - Complex Care Consultation",
];
const summary = {
  users: 0,
  dependents: 0,
  services: 0,
  appointments: 0,
  sessions: 0,
  notifications: 0,
};

const filipinoNames = [
  ["Jeff Ivan", "Mayor"],
  ["Maria Clara", "Santos"],
  ["Rogelio", "Dela Cruz"],
  ["Ana Mae", "Villanueva"],
  ["Joshua", "Manalo"],
  ["Beatriz", "Lim"],
  ["Carlo Miguel", "Pangilinan"],
  ["Lourdes", "Bautista"],
  ["Nico Paolo", "Rivera"],
  ["Katrina", "Mendoza"],
  ["Emmanuel", "Garcia"],
  ["Shaira", "Macapagal"],
  ["Daniel", "Cabrera"],
  ["Jasmine", "Ocampo"],
  ["Andrei", "Fernandez"],
  ["Alexandria Longpatient", "De Leon"],
  ["Mikaela", "Torres"],
  ["Paolo", "Navarro"],
  ["Celine", "Castillo"],
  ["Gabriel", "Ramos"],
];
const addresses = [
  "Malaybalay City, Bukidnon",
  "Valencia City, Bukidnon",
  "Cagayan de Oro City",
  "Iligan City, Northern Mindanao",
];
const therapistSpecs = [
  {
    firstname: "Yuan",
    lastname: "Simene",
    specialization: ["Sports Injury", "Post-op Rehab"],
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingHours: { start: "08:00", end: "17:00" },
  },
  {
    firstname: "Mara",
    lastname: "Villareal",
    specialization: ["Neuro Rehab"],
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingHours: { start: "08:00", end: "17:00" },
  },
  {
    firstname: "Iris",
    lastname: "Dizon",
    specialization: ["Pediatric OT"],
    workingDays: ["Tue", "Thu"],
    workingHours: { start: "13:00", end: "18:00" },
  },
  {
    firstname: "Noel",
    lastname: "Sarmiento",
    specialization: "",
    workingDays: [],
    workingHours: { start: "08:00", end: "17:00" },
  },
];

function option(list, index) {
  return list[index % list.length];
}
function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}
function dateString(date) {
  return date.toISOString().slice(0, 10);
}
function manilaDateTime(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours - 8,
      minutes,
    ),
  );
}
function manilaWeekday(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(date.getTime() + 12 * 60 * 60 * 1000));
}
function timeFor(therapist, offset = 0) {
  const start = Number(therapist.workingHours.start.split(":")[0]);
  const end = Number(therapist.workingHours.end.split(":")[0]);
  const hour = start + (offset % Math.max(1, end - start - 1));
  return `${String(hour).padStart(2, "0")}:00`;
}
function formatName(user) {
  return `${user.firstname} ${user.lastname}`.trim();
}
function dependentName(dependent) {
  return dependent ? `${dependent.firstName} ${dependent.lastName}` : "";
}
function roleEmail(role, index) {
  return `${role}${index ? index + 1 : ""}@absolutecare.test`;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function upsertUser(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return existing;
  const user = await User.create({
    ...data,
    password: await bcrypt.hash(seedPassword, 10),
    acceptedTerms: true,
    termsAcceptedAt: new Date(),
    mustChangePassword: false,
  });
  summary.users += 1;
  return user;
}

async function seedUsers() {
  const admin = await upsertUser({
    email: roleEmail("admin", 0),
    firstname: "AbsoluteCare",
    lastname: "Admin",
    role: "admin",
    phone: "+639171112222",
    address: addresses[2],
  });
  const secretary = await upsertUser({
    email: roleEmail("secretary", 0),
    firstname: "Liza",
    lastname: "Domingo",
    role: "secretary",
    phone: "+639181112233",
    address: addresses[2],
  });
  const therapists = [];
  for (const [index, profile] of therapistSpecs.entries())
    therapists.push(
      await upsertUser({
        ...profile,
        email: `therapist${index + 1}@absolutecare.test`,
        role: "therapist",
        phone: `+639${String(171000000 + index * 10001).slice(-9)}`,
        address: addresses[index % addresses.length],
      }),
    );
  const patients = [];
  for (let index = 0; index < patientCount; index += 1) {
    const [firstname, lastname] = option(filipinoNames, index);
    const email =
      index === 0
        ? "jeff.ivan@absolutecare.test"
        : `${firstname}.${lastname}.${index}@${index % 3 === 0 ? "student.buksu.test" : "gmail.test"}`
            .replace(/\s/g, "")
            .toLowerCase();
    const patient = await upsertUser({
      email,
      firstname,
      lastname,
      role: "user",
      phone:
        index % 7 === 0
          ? ""
          : `+639${String(991000000 + index * 731).slice(-9)}`,
      dateOfBirth:
        index % 8 === 0
          ? ""
          : `${1985 + (index % 24)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 25) + 1).padStart(2, "0")}`,
      address: option(addresses, index),
      authProvider: index === 1 ? "google" : "local",
      profilePicture: index === 1 ? "https://i.pravatar.cc/160?img=12" : "",
    });
    patients.push(patient);
  }
  const deactivated = patients[patients.length - 2];
  const archived = patients[patients.length - 1];
  if (deactivated && !deactivated.isArchived) {
    deactivated.isActive = false;
    await deactivated.save();
  }
  if (archived && !archived.isArchived) {
    archived.isArchived = true;
    archived.isActive = false;
    await archived.save();
  }
  return { admin, secretary, therapists, patients };
}

async function seedServices(admin) {
  const definitions = [
    [
      serviceNames[0],
      "Individual physical therapy for mobility, strength, and pain recovery.",
      60,
      800,
      "Physical Therapy",
    ],
    [
      serviceNames[1],
      "Play-based occupational therapy for children and adolescents.",
      45,
      1000,
      "Pediatric OT",
    ],
    [
      serviceNames[2],
      "Guided rehabilitation following surgery or hospital discharge.",
      60,
      1200,
      "Post-op Rehab",
    ],
    [
      serviceNames[3],
      "Return-to-activity rehabilitation for sports and workplace injuries.",
      60,
      1100,
      "Sports Injury",
    ],
    [
      serviceNames[4],
      "Goal-based neurological rehabilitation and movement retraining.",
      60,
      1300,
      "Neuro Rehab",
    ],
    [
      serviceNames[5],
      "First-visit assessment and care planning with a therapist.",
      45,
      700,
      "Assessment",
    ],
    [
      serviceNames[6],
      "Extended pediatric consultation for complex care planning.",
      90,
      1500,
      "Pediatric OT",
    ],
  ];
  const services = [];
  for (const [
    index,
    [name, description, duration, fee, category],
  ] of definitions.entries()) {
    let service = await TherapyService.findOne({ name });
    if (!service) {
      service = await TherapyService.create({
        name,
        description,
        duration,
        fee,
        category,
        isActive: index !== 5,
        auditLog: admin ? [{ action: "seeded", by: admin._id }] : [],
      });
      summary.services += 1;
    }
    services.push(service);
  }
  return services;
}

async function seedDependents(patients) {
  const guardians = patients.slice(0, Math.min(3, patients.length));
  const dependents = [];
  for (const [guardianIndex, guardian] of guardians.entries()) {
    const count = minimal ? 1 : guardianIndex + 1;
    for (let index = 0; index < count; index += 1) {
      const firstName = ["Juan", "Sofia", "Miguel"][guardianIndex];
      const lastName = `${guardian.lastname}-${index + 1}`;
      let dependent = await Dependent.findOne({
        guardian: guardian._id,
        firstName,
        lastName,
      });
      if (!dependent) {
        dependent = await Dependent.create({
          guardian: guardian._id,
          firstName,
          lastName,
          dateOfBirth: new Date(Date.UTC(2010 + guardianIndex, index + 1, 10)),
          sex: index % 2 ? "F" : "M",
          relationship: "Child",
          medicalNotes:
            index === 0 ? "Sensory and motor development goals." : "",
          isActive: true,
        });
        summary.dependents += 1;
      }
      dependents.push(dependent);
    }
  }
  return dependents;
}

function candidateSlots(therapists, today) {
  const slots = [];
  for (let offset = -60; offset <= 30; offset += 1) {
    const date = addDays(today, offset);
    for (const therapist of therapists.filter(
      (item) => item.workingDays.length,
    )) {
      if (!therapist.workingDays.includes(manilaWeekday(date))) continue;
      const startHour = Number(therapist.workingHours.start.slice(0, 2));
      const endHour = Number(therapist.workingHours.end.slice(0, 2));
      for (let hour = startHour; hour < endHour; hour += 1)
        slots.push({
          date,
          time: `${String(hour).padStart(2, "0")}:00`,
          therapist,
        });
    }
  }
  return slots;
}

async function seedAppointments({
  admin,
  therapists,
  patients,
  services,
  dependents,
}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const slots = candidateSlots(therapists, today);
  const usedTherapist = new Set();
  const usedPatient = new Set();
  const created = [];
  const activeTherapists = therapists.filter((item) => item.workingDays.length);
  const patientsForBooking = patients.filter(
    (item) => item.isActive && !item.isArchived,
  );
  let slotIndex = 0;
  async function make(status, index, options = {}) {
    const service = option(
      services.filter((item) => item.isActive),
      index,
    );
    const patient = option(patientsForBooking, index + 2);
    const dependent =
      dependents.find(
        (item) => String(item.guardian) === String(patient._id),
      ) && index % 3 === 0
        ? dependents.find(
            (item) => String(item.guardian) === String(patient._id),
          )
        : null;
    let slot = null;
    if (status !== "pending" && status !== "cancelled") {
      for (let tries = 0; tries < slots.length; tries += 1) {
        const possible = slots[(slotIndex + tries) % slots.length];
        const key = `${possible.therapist._id}:${dateString(possible.date)}:${possible.time}`;
        const patientKey = `${patient._id}:${dateString(possible.date)}:${possible.time}`;
        if (
          !usedTherapist.has(key) &&
          !usedPatient.has(patientKey) &&
          (options.future === undefined ||
            (options.future ? possible.date >= today : possible.date < today))
        ) {
          slot = possible;
          slotIndex += tries + 1;
          break;
        }
      }
      assert(slot, `Unable to allocate a non-overlapping ${status} slot`);
      usedTherapist.add(
        `${slot.therapist._id}:${dateString(slot.date)}:${slot.time}`,
      );
      usedPatient.add(`${patient._id}:${dateString(slot.date)}:${slot.time}`);
    } else {
      const future = addDays(today, 5 + index);
      slot = { date: future, time: "10:00", therapist: null };
    }
    const marker = `${SEED_PREFIX} appointment-${status}-${index}`;
    let appointment = await Appointment.findOne({ notes: marker });
    if (!appointment) {
      const start = slot.therapist
        ? manilaDateTime(slot.date, slot.time)
        : null;
      const end = start
        ? new Date(start.getTime() + service.duration * 60000)
        : null;
      appointment = await Appointment.create({
        patient: patient._id,
        dependent: dependent?._id || null,
        service: service._id,
        serviceSnapshot: {
          name: service.name,
          duration: service.duration,
          fee: service.fee,
          category: service.category,
        },
        requestedDate: dateString(slot.date),
        requestedTime: slot.time,
        scheduledStart: start,
        scheduledEnd: end,
        therapist: slot.therapist?._id || null,
        status,
        notes: marker,
        cancelReason:
          status === "cancelled" ? "Clinic schedule adjustment" : "",
        cancelledBy: status === "cancelled" ? admin._id : null,
        auditLog: [
          {
            action: "seeded",
            by: admin._id,
            fromStatus: "pending",
            toStatus: status,
          },
        ],
      });
      summary.appointments += 1;
    }
    created.push(appointment);
    return appointment;
  }
  const groups = minimal
    ? [
        ["pending", 2],
        ["confirmed", 3],
        ["completed", 3],
        ["cancelled", 1],
        ["no_show", 1],
      ]
    : [
        ["pending", 12],
        ["confirmed", 20],
        ["completed", 28],
        ["cancelled", 8],
        ["no_show", 4],
      ];
  for (const [status, count] of groups)
    for (let index = 0; index < count; index += 1)
      await make(status, index + created.length, {
        future:
          status === "confirmed"
            ? true
            : status === "completed" || status === "no_show"
              ? false
              : undefined,
      });
  if (!minimal)
    for (let index = 0; index < 3; index += 1)
      await make("confirmed", index + created.length, { future: false });
  const confirmed = created.filter((item) => item.status === "confirmed");
  for (
    let index = 0;
    index < Math.min(minimal ? 1 : 8, confirmed.length);
    index += 1
  ) {
    const appointment = confirmed[index];
    appointment.rescheduleRequest = {
      status: "requested",
      proposedDate: dateString(addDays(today, 10 + index)),
      proposedTime: "11:00",
      reason: "Family schedule changed.",
      requestedBy: index % 2 ? "therapist" : "patient",
      requestedAt: new Date(),
    };
    await appointment.save();
  }
  return created;
}

async function seedSessions(appointments, admin) {
  const completed = appointments.filter((item) => item.status === "completed");
  for (const [index, appointment] of completed.entries()) {
    if (await Session.exists({ appointment: appointment._id })) continue;
    await Session.create({
      appointment: appointment._id,
      patient: appointment.patient,
      dependent: appointment.dependent,
      therapist: appointment.therapist,
      service: appointment.service,
      sessionDate: appointment.scheduledStart,
      durationMinutes: appointment.serviceSnapshot.duration,
      patientVisibleNotes:
        "Your therapist recorded progress and next-step guidance for this visit.",
      clinicalNotes: `SEED clinical note ${index + 1}: gait, strength, and home program reviewed.`,
    });
    summary.sessions += 1;
  }
  return completed;
}

async function seedPayments(appointments, secretary, admin) {
  for (const [index, appointment] of appointments.entries()) {
    if (
      !appointment ||
      !["completed", "confirmed", "no_show"].includes(appointment.status)
    )
      continue;
    const shouldPay = appointment.status === "completed" && index % 5 !== 0;
    if (!shouldPay || appointment.payment?.status === "paid") continue;
    appointment.payment = {
      status: "paid",
      amount: appointment.serviceSnapshot.fee,
      method: option(["cash", "gcash", "card"], index),
      referenceNumber:
        index % 3 === 0 ? `SEED-${String(index).padStart(4, "0")}` : "",
      recordedBy: index % 2 ? secretary._id : admin._id,
      recordedAt: new Date(
        (appointment.scheduledEnd || appointment.createdAt).getTime() +
          86400000,
      ),
    };
    appointment.paymentAudit.push({
      action: "seeded",
      by: appointment.payment.recordedBy,
      details: "Development payment fixture",
    });
    await appointment.save();
  }
}

async function addNotification(data) {
  const exists = await Notification.findOne({
    user: data.user,
    type: data.type,
    appointment: data.appointment || null,
    message: data.message,
  });
  if (exists) return exists;
  const notification = await Notification.create(data);
  summary.notifications += 1;
  return notification;
}

async function seedNotifications({
  admin,
  therapists,
  patients,
  appointments,
  dependents,
}) {
  for (const appointment of appointments) {
    const patient = patients.find(
      (item) => String(item._id) === String(appointment.patient),
    );
    const therapist = therapists.find(
      (item) => String(item._id) === String(appointment.therapist),
    );
    const dependent = dependents.find(
      (item) => String(item._id) === String(appointment.dependent),
    );
    const subject = dependent
      ? `${dependentName(dependent)}'s appointment`
      : "Your appointment";
    const linkPatient = `/dashboard/appointments/${appointment._id}`;
    if (appointment.status === "pending")
      await addNotification({
        user: admin._id,
        type: "appointment_requested",
        title: "New appointment request",
        message: `${formatName(patient)} requested ${appointment.serviceSnapshot.name}.`,
        appointment: appointment._id,
        dependent: dependent?._id || null,
        link: `/staff/admin/appointments/${appointment._id}`,
        isRead: false,
      });
    if (appointment.status === "confirmed") {
      if (patient)
        await addNotification({
          user: patient._id,
          type: "appointment_confirmed",
          title: "Appointment confirmed",
          message: `${subject} on ${appointment.requestedDate} was confirmed.`,
          appointment: appointment._id,
          dependent: dependent?._id || null,
          link: linkPatient,
          isRead: appointment._id.toString().slice(-1) % 2 === 0,
        });
      if (therapist)
        await addNotification({
          user: therapist._id,
          type: "appointment_assigned",
          title: "Appointment assigned",
          message: `A new appointment is on your schedule for ${appointment.requestedDate}.`,
          appointment: appointment._id,
          dependent: dependent?._id || null,
          link: `/staff/therapist/appointments/${appointment._id}`,
          isRead: true,
        });
      if (appointment.rescheduleRequest?.status === "requested")
        await addNotification({
          user: admin._id,
          type: "reschedule_requested",
          title: "Reschedule request",
          message: `${formatName(patient)} requested a new appointment time.`,
          appointment: appointment._id,
          link: `/staff/admin/appointments/${appointment._id}`,
          isRead: false,
        });
    }
    if (appointment.status === "completed" && patient)
      await addNotification({
        user: patient._id,
        type: "session_recorded",
        title: "Session recorded",
        message: `${subject} has a new session update in your portal.`,
        appointment: appointment._id,
        dependent: dependent?._id || null,
        link: linkPatient,
        isRead: false,
      });
    if (appointment.status === "cancelled" && patient)
      await addNotification({
        user: patient._id,
        type: "appointment_cancelled",
        title: "Appointment cancelled",
        message: `${subject} was cancelled: ${appointment.cancelReason}.`,
        appointment: appointment._id,
        dependent: dependent?._id || null,
        link: linkPatient,
        isRead: true,
      });
  }
  const future = appointments
    .filter((item) => item.status === "confirmed")
    .slice(0, minimal ? 1 : 4);
  for (const appointment of future) {
    const patient = patients.find(
      (item) => String(item._id) === String(appointment.patient),
    );
    if (patient)
      await addNotification({
        user: patient._id,
        type: "appointment_reminder",
        title: "Appointment reminder",
        message: "You have an appointment coming up soon.",
        appointment: appointment._id,
        link: `/dashboard/appointments/${appointment._id}`,
        isRead: false,
      });
  }
}

async function validateSeed({ users, services, appointments }) {
  const seededUsers = [
    users.admin,
    users.secretary,
    ...users.therapists,
    ...users.patients,
  ];
  assert(
    (await User.countDocuments({
      _id: { $in: seededUsers.map((item) => item._id) },
    })) === seededUsers.length,
    "Seed users are missing",
  );
  assert(
    new Set(users.patients.map((item) => item.email)).size ===
      users.patients.length,
    "Duplicate patient emails generated",
  );
  const seen = new Set();
  for (const appointment of appointments.filter(
    (item) => item.therapist && item.scheduledStart,
  )) {
    const key = `${appointment.therapist}:${appointment.scheduledStart.toISOString()}`;
    assert(!seen.has(key), `Therapist double-booking: ${key}`);
    seen.add(key);
  }
  for (const session of await Session.find({
    appointment: { $in: appointments.map((item) => item._id) },
  })) {
    const appointment = appointments.find(
      (item) => String(item._id) === String(session.appointment),
    );
    assert(
      appointment?.status === "completed",
      "Session belongs to a non-completed appointment",
    );
  }
  for (const appointment of await Appointment.find({
    _id: { $in: appointments.map((item) => item._id) },
    "payment.status": "paid",
  }))
    assert(
      Number(appointment.payment.amount) ===
        Number(appointment.serviceSnapshot.fee),
      "Paid amount does not match service snapshot",
    );
  assert(services.length >= 6, "Expected seeded services");
}

function targetDatabaseName() {
  try {
    return new URL(MONGO_URI).pathname.replace(/^\//, "") || "unknown";
  } catch {
    return "unknown";
  }
}
async function resetSeedData() {
  const users = await User.find({ email: { $regex: seedEmails } }).select(
    "_id",
  );
  const userIds = users.map((item) => item._id);
  const appointments = await Appointment.find({
    notes: { $regex: `^${SEED_PREFIX}` },
  }).select("_id");
  const appointmentIds = appointments.map((item) => item._id);
  await Notification.deleteMany({
    $or: [{ user: { $in: userIds } }, { appointment: { $in: appointmentIds } }],
  });
  await Session.deleteMany({ appointment: { $in: appointmentIds } });
  await Appointment.deleteMany({ _id: { $in: appointmentIds } });
  await Dependent.deleteMany({ guardian: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  await TherapyService.deleteMany({ name: { $in: serviceNames } });
}

async function main() {
  const started = Date.now();
  const database = targetDatabaseName();
  console.log(`Seed target: ${database}`);
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing to seed NODE_ENV=production.");
  if (!/(dev|test|local|absolutecare)/i.test(database))
    throw new Error(
      `Refusing to seed database ${database}. Use a development/test/local database.`,
    );
  if (reset && !yes) {
    if (!process.stdin.isTTY)
      throw new Error(
        "--reset is destructive. Re-run with --reset --yes in a non-interactive shell.",
      );
    const prompt = createInterface({ input, output });
    const answer = await prompt.question(
      "This removes only AbsoluteCare seed records. Continue? Type yes: ",
    );
    prompt.close();
    if (answer.trim().toLowerCase() !== "yes")
      throw new Error("Reset cancelled.");
  }
  await mongoose.connect(MONGO_URI);
  try {
    if (reset) await resetSeedData();
    const users = await seedUsers();
    const services = await seedServices(users.admin);
    const dependents = await seedDependents(users.patients);
    const appointments = await seedAppointments({
      ...users,
      services,
      dependents,
    });
    await seedSessions(appointments, users.admin);
    await seedPayments(appointments, users.secretary, users.admin);
    await seedNotifications({ ...users, appointments, dependents });
    await validateSeed({ users, services, appointments });
    console.log(`Seed complete in ${Date.now() - started}ms`);
    console.table(summary);
    console.log("Demo logins:");
    console.table([
      {
        role: "Admin",
        email: "admin@absolutecare.test",
        password: seedPassword,
      },
      {
        role: "Secretary",
        email: "secretary@absolutecare.test",
        password: seedPassword,
      },
      {
        role: "Therapist",
        email: "therapist1@absolutecare.test",
        password: seedPassword,
      },
      {
        role: "Patient",
        email: "jeff.ivan@absolutecare.test",
        password: seedPassword,
      },
    ]);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  mongoose.disconnect().finally(() => (process.exitCode = 1));
});
