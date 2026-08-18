/**
 * The sample company: WinitLaw — one legal entity in New York, 19 people.
 *
 * Everything here is invented. The email addresses, phone numbers, tax id,
 * national IDs and passwords are fake and only ever exist inside the browser
 * tab.
 *
 * `seed()` returns a fresh object every call, so resetting the mock database is
 * just calling it again — nothing is shared between the seed and the live rows.
 *
 * The data is deliberately uneven: someone is on leave, someone is on
 * probation, someone is in training, someone starts next month with no seat
 * yet, someone was terminated, one position is open, one frozen, one closed.
 * Every state the screens can render is represented by at least one row, so a
 * UI change that breaks one of them is visible without inventing data first.
 *
 * The tree, with each unit's manager. Reporting lines are *derived* from this
 * and nothing else — see `managerOf` in serializers.ts:
 *
 *   Winit                      —            nobody sits here; a visual root
 *   └── C-Level                Ricardo      approvals stop here
 *       └── Management         Renata
 *           ├── Operations     Javier
 *           │   ├── Collections  Andrés
 *           │   ├── CX           Lucía
 *           │   ├── QA           Paula
 *           │   └── IT           —          falls through to Javier
 *           └── Sales          Camila
 *               └── NY · CA · NC · NJ  —    all fall through to Camila
 */

import type { AttendanceEventRow, EmploymentRow, MockDb } from "./rows"

export function seed(): MockDb {
  const db: MockDb = {
    legalEntities: [
      {
        id: "le-1",
        name: "WinitLaw",
        tax_id: "47-3915820",
        country: "US",
        currency: "USD",
        timezone: "America/New_York",
        is_active: true,
      },
    ],

    locations: [
      {
        id: "loc-1",
        name: "New York Office",
        type: "OFFICE",
        timezone: "America/New_York",
        country: "US",
        is_active: true,
      },
      {
        id: "loc-2",
        name: "California Office",
        type: "OFFICE",
        timezone: "America/Los_Angeles",
        country: "US",
        is_active: true,
      },
      {
        id: "loc-3",
        name: "North Carolina Office",
        type: "OFFICE",
        timezone: "America/New_York",
        country: "US",
        is_active: true,
      },
      {
        id: "loc-4",
        name: "New Jersey Office",
        type: "OFFICE",
        timezone: "America/New_York",
        country: "US",
        is_active: true,
      },
      {
        id: "loc-5",
        name: "Remote — US",
        type: "REMOTE",
        timezone: "America/New_York",
        country: "US",
        is_active: true,
      },
    ],

    jobTitles: [
      {
        id: "jt-1",
        name: "Chief Executive Officer",
        code: "CEO",
        job_family: "Executive",
        description: "Accountable for the firm's strategy and results.",
        is_active: true,
      },
      {
        id: "jt-2",
        name: "Chief Operating Officer",
        code: "COO",
        job_family: "Executive",
        description: "Owns day-to-day operations across every department.",
        is_active: true,
      },
      {
        id: "jt-3",
        name: "Operations Manager",
        code: "OPS-MGR",
        job_family: "Management",
        description: "Runs the operations teams and their service levels.",
        is_active: true,
      },
      {
        id: "jt-4",
        name: "Sales Manager",
        code: "SLS-MGR",
        job_family: "Management",
        description: "Owns the sales territories, quota and pipeline.",
        is_active: true,
      },
      {
        id: "jt-5",
        name: "Collections Specialist",
        code: "COL-SPEC",
        job_family: "Operations",
        description: "Works accounts through to recovery or settlement.",
        is_active: true,
      },
      {
        id: "jt-6",
        name: "Customer Experience Representative",
        code: "CX-REP",
        job_family: "Operations",
        description: "First line of contact for client questions and updates.",
        is_active: true,
      },
      {
        id: "jt-7",
        name: "Quality Assurance Analyst",
        code: "QA-ANL",
        job_family: "Operations",
        description: "Reviews case handling and call quality against policy.",
        is_active: true,
      },
      {
        id: "jt-8",
        name: "IT Support Specialist",
        code: "IT-SUP",
        job_family: "Technology",
        description: "Keeps the desktop fleet, accounts and phone system running.",
        is_active: true,
      },
      {
        id: "jt-9",
        name: "Sales Team Lead",
        code: "SLS-LEAD",
        job_family: "Sales",
        description: "Leads one territory's reps and carries a reduced quota.",
        is_active: true,
      },
      {
        id: "jt-10",
        name: "Sales Representative",
        code: "SLS-REP",
        job_family: "Sales",
        description: "Sources and closes new client engagements in a territory.",
        is_active: true,
      },
      {
        id: "jt-11",
        name: "General Manager",
        code: "GEN-MGR",
        job_family: "Management",
        description: "Runs Operations and Sales; reports to the CEO.",
        is_active: true,
      },
      {
        id: "jt-12",
        name: "Operations Coordinator",
        code: "OPS-COORD",
        job_family: "Operations",
        description:
          "Department-wide operations support, not attached to one team.",
        is_active: true,
      },
    ],

    orgUnits: [
      {
        id: "ou-1",
        parent: null,
        name: "Winit",
        code: "WNT",
        type: "COMPANY",
        // Nobody sits at the company node — it exists to give the chart a
        // single root. With no members it can have no manager, which is what
        // makes C-Level the top of the chain and where approvals stop.
        manager_employment: null,
        cost_center: "CC-1000",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-2",
        parent: "ou-1",
        name: "C-Level",
        code: "EXEC",
        type: "DEPARTMENT",
        manager_employment: "emp-1",
        cost_center: "CC-1100",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-3",
        parent: "ou-2",
        name: "Management",
        code: "MGMT",
        type: "DEPARTMENT",
        manager_employment: "emp-17",
        cost_center: "CC-1200",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-4",
        parent: "ou-3",
        name: "Operations",
        code: "OPS",
        type: "DEPARTMENT",
        manager_employment: "emp-3",
        cost_center: "CC-2000",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-5",
        parent: "ou-3",
        name: "Sales",
        code: "SLS",
        type: "DEPARTMENT",
        manager_employment: "emp-4",
        cost_center: "CC-3000",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-6",
        parent: "ou-4",
        name: "Collections",
        code: "OPS-COL",
        type: "TEAM",
        manager_employment: "emp-5",
        cost_center: "CC-2100",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-7",
        parent: "ou-4",
        name: "CX",
        code: "OPS-CX",
        type: "TEAM",
        manager_employment: "emp-8",
        cost_center: "CC-2200",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-8",
        parent: "ou-4",
        name: "QA",
        code: "OPS-QA",
        type: "TEAM",
        manager_employment: "emp-9",
        cost_center: "CC-2300",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-9",
        parent: "ou-4",
        name: "IT",
        code: "OPS-IT",
        type: "TEAM",
        // No lead: the screens must render the empty case too.
        manager_employment: null,
        cost_center: "CC-2400",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-10",
        parent: "ou-5",
        name: "NY",
        code: "SLS-NY",
        type: "TEAM",
        // The state teams have no lead of their own: the reps report to the
        // Sales Manager, with the Sales Team Lead assisting across all four.
        manager_employment: null,
        cost_center: "CC-3100",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-11",
        parent: "ou-5",
        name: "CA",
        code: "SLS-CA",
        type: "TEAM",
        manager_employment: null,
        cost_center: "CC-3200",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-12",
        parent: "ou-5",
        name: "NC",
        code: "SLS-NC",
        type: "TEAM",
        manager_employment: null,
        cost_center: "CC-3300",
        legal_entity: "le-1",
        is_active: true,
      },
      {
        id: "ou-13",
        parent: "ou-5",
        name: "NJ",
        code: "SLS-NJ",
        type: "TEAM",
        manager_employment: null,
        cost_center: "CC-3400",
        legal_entity: "le-1",
        is_active: true,
      },
    ],

    people: [
      {
        id: "p-1",
        first_name: "Ricardo",
        last_name: "Salazar",
        preferred_name: "",
        national_id: "***-**-4471",
        national_id_country: "US",
        birth_date: "1974-03-18",
        gender: "MALE",
        personal_email: "ricardo.salazar@example.com",
        personal_phone: "+1 212 555 0141",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Elena Salazar", relation: "Spouse", phone: "+1 212 555 0142" },
        ],
      },
      {
        id: "p-2",
        first_name: "Mariana",
        last_name: "Vargas",
        preferred_name: "",
        national_id: "***-**-8820",
        national_id_country: "US",
        birth_date: "1980-07-09",
        gender: "FEMALE",
        personal_email: "mariana.vargas@example.com",
        personal_phone: "+1 917 555 0188",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Hugo Vargas", relation: "Spouse", phone: "+1 917 555 0189" },
        ],
      },
      {
        id: "p-3",
        first_name: "Javier",
        last_name: "Montoya",
        preferred_name: "Javi",
        national_id: "***-**-3312",
        national_id_country: "US",
        birth_date: "1983-11-27",
        gender: "MALE",
        personal_email: "javier.montoya@example.com",
        personal_phone: "+1 646 555 0107",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Carmen Montoya", relation: "Sister", phone: "+1 646 555 0108" },
        ],
      },
      {
        id: "p-4",
        first_name: "Camila",
        last_name: "Restrepo",
        preferred_name: "",
        national_id: "***-**-9014",
        national_id_country: "US",
        birth_date: "1986-05-02",
        gender: "FEMALE",
        personal_email: "camila.restrepo@example.com",
        personal_phone: "+1 718 555 0155",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Julián Restrepo", relation: "Brother", phone: "+1 718 555 0156" },
        ],
      },
      {
        id: "p-5",
        first_name: "Andrés",
        last_name: "Quintero",
        preferred_name: "",
        national_id: "***-**-7726",
        national_id_country: "US",
        birth_date: "1988-09-14",
        gender: "MALE",
        personal_email: "andres.quintero@example.com",
        personal_phone: "+1 347 555 0122",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Rosa Quintero", relation: "Mother", phone: "+1 347 555 0123" },
        ],
      },
      {
        id: "p-6",
        first_name: "Valentina",
        last_name: "Ríos",
        preferred_name: "Vale",
        national_id: "***-**-2288",
        national_id_country: "US",
        birth_date: "1997-01-30",
        gender: "FEMALE",
        personal_email: "valentina.rios@example.com",
        personal_phone: "+1 929 555 0134",
        pronouns: "she/her",
        // Deliberately missing: the People screen flags this in red.
        emergency_contact: [],
      },
      {
        id: "p-7",
        first_name: "Diego",
        last_name: "Fuentes",
        preferred_name: "",
        national_id: "***-**-5590",
        national_id_country: "US",
        birth_date: "1992-04-21",
        gender: "MALE",
        personal_email: "diego.fuentes@example.com",
        personal_phone: "+1 862 555 0166",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Paola Fuentes", relation: "Partner", phone: "+1 862 555 0167" },
        ],
      },
      {
        id: "p-8",
        first_name: "Lucía",
        last_name: "Arellano",
        preferred_name: "Lucy",
        national_id: "***-**-6603",
        national_id_country: "US",
        birth_date: "1990-12-06",
        gender: "FEMALE",
        personal_email: "lucia.arellano@example.com",
        personal_phone: "+1 212 555 0119",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Marco Arellano", relation: "Father", phone: "+1 212 555 0120" },
        ],
      },
      {
        id: "p-9",
        first_name: "Paula",
        last_name: "Escobar",
        preferred_name: "",
        national_id: "***-**-1145",
        national_id_country: "US",
        birth_date: "1991-08-11",
        gender: "FEMALE",
        personal_email: "paula.escobar@example.com",
        personal_phone: "+1 984 555 0198",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Sergio Escobar", relation: "Spouse", phone: "+1 984 555 0199" },
        ],
      },
      {
        id: "p-10",
        first_name: "Emiliano",
        last_name: "Bustos",
        preferred_name: "Emi",
        national_id: "***-**-3078",
        national_id_country: "US",
        birth_date: "1994-06-25",
        gender: "MALE",
        personal_email: "emiliano.bustos@example.com",
        personal_phone: "+1 551 555 0177",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Norma Bustos", relation: "Mother", phone: "+1 551 555 0178" },
        ],
      },
      {
        id: "p-11",
        first_name: "Sofía",
        last_name: "Delgado",
        preferred_name: "Sofi",
        national_id: "***-**-4402",
        national_id_country: "US",
        birth_date: "1989-02-17",
        gender: "FEMALE",
        personal_email: "sofia.delgado@example.com",
        personal_phone: "+1 917 555 0163",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Iván Delgado", relation: "Brother", phone: "+1 917 555 0164" },
        ],
      },
      {
        id: "p-12",
        first_name: "Mateo",
        last_name: "Herrera",
        preferred_name: "",
        national_id: "***-**-9931",
        national_id_country: "US",
        birth_date: "1993-10-08",
        gender: "MALE",
        personal_email: "mateo.herrera@example.com",
        personal_phone: "+1 213 555 0110",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Adriana Herrera", relation: "Spouse", phone: "+1 213 555 0111" },
        ],
      },
      {
        id: "p-13",
        first_name: "Rachel",
        last_name: "Whitman",
        preferred_name: "",
        national_id: "***-**-2764",
        national_id_country: "US",
        birth_date: "1995-03-29",
        gender: "FEMALE",
        personal_email: "rachel.whitman@example.com",
        personal_phone: "+1 704 555 0102",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Owen Whitman", relation: "Father", phone: "+1 704 555 0103" },
        ],
      },
      {
        id: "p-14",
        first_name: "Gabriel",
        last_name: "Ocampo",
        preferred_name: "Gabo",
        national_id: "***-**-8157",
        national_id_country: "US",
        birth_date: "1996-07-13",
        gender: "MALE",
        personal_email: "gabriel.ocampo@example.com",
        personal_phone: "+1 973 555 0148",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Beatriz Ocampo", relation: "Mother", phone: "+1 973 555 0149" },
        ],
      },
      {
        id: "p-15",
        first_name: "Natalia",
        last_name: "Peña",
        preferred_name: "",
        national_id: "***-**-6620",
        national_id_country: "US",
        birth_date: "1998-11-05",
        gender: "FEMALE",
        personal_email: "natalia.pena@example.com",
        personal_phone: "+1 646 555 0191",
        pronouns: "she/her",
        emergency_contact: [],
      },
      {
        id: "p-16",
        first_name: "Tomás",
        last_name: "Aguirre",
        preferred_name: "Tom",
        national_id: "***-**-5033",
        national_id_country: "US",
        birth_date: "2004-01-22",
        gender: "MALE",
        personal_email: "tomas.aguirre@example.com",
        personal_phone: "+1 929 555 0175",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Silvia Aguirre", relation: "Mother", phone: "+1 929 555 0176" },
        ],
      },
      {
        id: "p-17",
        first_name: "Renata",
        last_name: "Salcedo",
        preferred_name: "",
        national_id: "***-**-7719",
        national_id_country: "US",
        birth_date: "1982-09-04",
        gender: "FEMALE",
        personal_email: "renata.salcedo@example.com",
        personal_phone: "+1 212 555 0128",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Óscar Salcedo", relation: "Spouse", phone: "+1 212 555 0129" },
        ],
      },
      {
        id: "p-18",
        first_name: "Carolina",
        last_name: "Duarte",
        preferred_name: "Caro",
        national_id: "***-**-4260",
        national_id_country: "US",
        birth_date: "1990-02-19",
        gender: "FEMALE",
        personal_email: "carolina.duarte@example.com",
        personal_phone: "+1 646 555 0184",
        pronouns: "she/her",
        emergency_contact: [
          { name: "Rubén Duarte", relation: "Brother", phone: "+1 646 555 0185" },
        ],
      },
      {
        id: "p-19",
        first_name: "Héctor",
        last_name: "Molina",
        preferred_name: "",
        national_id: "***-**-3095",
        national_id_country: "US",
        birth_date: "1994-12-01",
        gender: "MALE",
        personal_email: "hector.molina@example.com",
        personal_phone: "+1 917 555 0137",
        pronouns: "he/him",
        emergency_contact: [
          { name: "Alicia Molina", relation: "Mother", phone: "+1 917 555 0138" },
        ],
      },
    ],

    positions: [
      {
        id: "pos-1",
        job_title: "jt-1",
        org_unit: "ou-2",
        location: "loc-1",
        seniority: "EXEC",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "300000.00",
        salary_band_max: "360000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-2",
        job_title: "jt-2",
        org_unit: "ou-2",
        location: "loc-1",
        seniority: "EXEC",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "240000.00",
        salary_band_max: "290000.00",
        currency: "USD",
        headcount: 1,
      },
      // Department managers sit inside the department they run, not in
      // Management — so the org chart shows them at the top of their own unit.
      {
        id: "pos-3",
        job_title: "jt-3",
        org_unit: "ou-4",
        location: "loc-1",
        seniority: "MANAGER",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "110000.00",
        salary_band_max: "135000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-4",
        job_title: "jt-4",
        org_unit: "ou-5",
        location: "loc-1",
        seniority: "MANAGER",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "110000.00",
        salary_band_max: "140000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-5",
        job_title: "jt-5",
        org_unit: "ou-6",
        location: "loc-1",
        seniority: "SENIOR",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "62000.00",
        salary_band_max: "78000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-6",
        job_title: "jt-5",
        org_unit: "ou-6",
        location: "loc-5",
        seniority: "MID",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "48000.00",
        salary_band_max: "60000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-7",
        job_title: "jt-5",
        org_unit: "ou-6",
        location: "loc-1",
        seniority: "JUNIOR",
        is_people_manager: false,
        status: "OPEN",
        salary_band_min: "42000.00",
        salary_band_max: "52000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-8",
        job_title: "jt-6",
        org_unit: "ou-7",
        location: "loc-5",
        seniority: "MID",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "40000.00",
        salary_band_max: "52000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-9",
        job_title: "jt-6",
        org_unit: "ou-7",
        location: "loc-1",
        seniority: "SENIOR",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "55000.00",
        salary_band_max: "68000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-10",
        job_title: "jt-7",
        org_unit: "ou-8",
        location: "loc-5",
        seniority: "MID",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "58000.00",
        salary_band_max: "72000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-11",
        job_title: "jt-7",
        org_unit: "ou-8",
        location: "loc-1",
        seniority: "INTERN",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "24000.00",
        salary_band_max: "30000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-12",
        job_title: "jt-8",
        org_unit: "ou-9",
        location: "loc-1",
        seniority: "MID",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "60000.00",
        salary_band_max: "75000.00",
        currency: "USD",
        headcount: 1,
      },
      // Sits at Sales level, not in a state team: this seat assists the Sales
      // Manager across all four territories and leads none of them.
      {
        id: "pos-13",
        job_title: "jt-9",
        org_unit: "ou-5",
        location: "loc-1",
        seniority: "LEAD",
        is_people_manager: true,
        status: "FILLED",
        salary_band_min: "75000.00",
        salary_band_max: "95000.00",
        currency: "USD",
        headcount: 1,
      },
      // Sofía's old seat, backfilled when she moved up to Sales level.
      {
        id: "pos-14",
        job_title: "jt-10",
        org_unit: "ou-10",
        location: "loc-1",
        seniority: "MID",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "45000.00",
        salary_band_max: "60000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-15",
        job_title: "jt-10",
        org_unit: "ou-11",
        location: "loc-2",
        seniority: "MID",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "45000.00",
        salary_band_max: "60000.00",
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-16",
        job_title: "jt-10",
        org_unit: "ou-12",
        location: "loc-3",
        seniority: "MID",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "45000.00",
        salary_band_max: "60000.00",
        currency: "USD",
        headcount: 1,
      },
      // Closed when Gabriel Ocampo left and the seat was not backfilled.
      {
        id: "pos-17",
        job_title: "jt-10",
        org_unit: "ou-13",
        location: "loc-4",
        seniority: "JUNIOR",
        is_people_manager: false,
        status: "CLOSED",
        salary_band_min: null,
        salary_band_max: null,
        currency: "USD",
        headcount: 1,
      },
      {
        id: "pos-18",
        job_title: "jt-10",
        org_unit: "ou-13",
        location: "loc-4",
        seniority: "MID",
        is_people_manager: false,
        status: "FROZEN",
        salary_band_min: "45000.00",
        salary_band_max: "60000.00",
        currency: "USD",
        headcount: 1,
      },
      // The whole of Management: one seat.
      {
        id: "pos-19",
        job_title: "jt-11",
        org_unit: "ou-3",
        location: "loc-1",
        seniority: "MANAGER",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "85000.00",
        salary_band_max: "105000.00",
        currency: "USD",
        headcount: 1,
      },
      // Department-level Operations: in Ops, in none of its teams, not the
      // manager.
      {
        id: "pos-20",
        job_title: "jt-12",
        org_unit: "ou-4",
        location: "loc-1",
        seniority: "MID",
        is_people_manager: false,
        status: "FILLED",
        salary_band_min: "55000.00",
        salary_band_max: "70000.00",
        currency: "USD",
        headcount: 1,
      },
    ],

    employments: [
      {
        id: "emp-1",
        person: "p-1",
        legal_entity: "le-1",
        employee_code: "W-1001",
        employment_type: "FULL_TIME",
        work_mode: "HYBRID",
        hire_date: "2016-01-04",
        probation_end_date: "2016-04-04",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "ricardo.salazar@winitlaw.com",
        slack_handle: "@ricardo",
      },
      {
        id: "emp-2",
        person: "p-2",
        legal_entity: "le-1",
        employee_code: "W-1002",
        employment_type: "FULL_TIME",
        work_mode: "HYBRID",
        hire_date: "2017-03-06",
        probation_end_date: "2017-06-06",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "mariana.vargas@winitlaw.com",
        slack_handle: "@mariana",
      },
      {
        id: "emp-3",
        person: "p-3",
        legal_entity: "le-1",
        employee_code: "W-1003",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2018-06-11",
        probation_end_date: "2018-09-11",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "javier.montoya@winitlaw.com",
        slack_handle: "@javi",
      },
      {
        id: "emp-4",
        person: "p-4",
        legal_entity: "le-1",
        employee_code: "W-1004",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2019-02-04",
        probation_end_date: "2019-05-04",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "camila.restrepo@winitlaw.com",
        slack_handle: "@camila",
      },
      {
        id: "emp-5",
        person: "p-5",
        legal_entity: "le-1",
        employee_code: "W-1005",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2019-09-16",
        probation_end_date: "2019-12-16",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "andres.quintero@winitlaw.com",
        slack_handle: "@andres",
      },
      {
        id: "emp-6",
        person: "p-6",
        legal_entity: "le-1",
        employee_code: "W-1006",
        employment_type: "FULL_TIME",
        work_mode: "REMOTE",
        hire_date: "2026-04-06",
        probation_end_date: "2026-10-06",
        termination_date: null,
        status: "PROBATION",
        timezone: "America/New_York",
        work_email: "valentina.rios@winitlaw.com",
        slack_handle: "@vale",
      },
      {
        id: "emp-7",
        person: "p-7",
        legal_entity: "le-1",
        employee_code: "W-1007",
        employment_type: "PART_TIME",
        work_mode: "REMOTE",
        hire_date: "2022-07-11",
        probation_end_date: "2022-10-11",
        termination_date: null,
        status: "ON_LEAVE",
        timezone: "America/New_York",
        work_email: "diego.fuentes@winitlaw.com",
        slack_handle: "@diego",
      },
      {
        id: "emp-8",
        person: "p-8",
        legal_entity: "le-1",
        employee_code: "W-1008",
        employment_type: "FULL_TIME",
        work_mode: "HYBRID",
        hire_date: "2020-11-02",
        probation_end_date: "2021-02-02",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "lucia.arellano@winitlaw.com",
        slack_handle: "@lucy",
      },
      {
        id: "emp-9",
        person: "p-9",
        legal_entity: "le-1",
        employee_code: "W-1009",
        employment_type: "FULL_TIME",
        work_mode: "REMOTE",
        hire_date: "2021-05-17",
        probation_end_date: "2021-08-17",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "paula.escobar@winitlaw.com",
        slack_handle: "@paula",
      },
      {
        id: "emp-10",
        person: "p-10",
        legal_entity: "le-1",
        employee_code: "W-1010",
        employment_type: "CONTRACTOR",
        work_mode: "HYBRID",
        hire_date: "2023-01-09",
        probation_end_date: null,
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "emiliano.bustos@winitlaw.com",
        slack_handle: "@emi",
      },
      {
        id: "emp-11",
        person: "p-11",
        legal_entity: "le-1",
        employee_code: "W-1011",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2020-08-03",
        probation_end_date: "2020-11-03",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "sofia.delgado@winitlaw.com",
        slack_handle: "@sofi",
      },
      {
        id: "emp-12",
        person: "p-12",
        legal_entity: "le-1",
        employee_code: "W-1012",
        employment_type: "FULL_TIME",
        work_mode: "REMOTE",
        hire_date: "2022-02-14",
        probation_end_date: "2022-05-14",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/Los_Angeles",
        work_email: "mateo.herrera@winitlaw.com",
        slack_handle: "@mateo",
      },
      {
        id: "emp-13",
        person: "p-13",
        legal_entity: "le-1",
        employee_code: "W-1013",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2023-08-07",
        probation_end_date: "2023-11-07",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "rachel.whitman@winitlaw.com",
        slack_handle: "@rachel",
      },
      {
        id: "emp-14",
        person: "p-14",
        legal_entity: "le-1",
        employee_code: "W-1014",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2021-10-04",
        probation_end_date: "2022-01-04",
        termination_date: "2026-05-29",
        status: "TERMINATED",
        timezone: "America/New_York",
        work_email: "gabriel.ocampo@winitlaw.com",
        slack_handle: "",
      },
      // Starts next month, so no assignment yet: the Employments screen shows
      // "Unassigned" and the row menu offers "Assign position".
      {
        id: "emp-15",
        person: "p-15",
        legal_entity: "le-1",
        employee_code: "W-1015",
        employment_type: "FULL_TIME",
        work_mode: "REMOTE",
        hire_date: "2026-09-08",
        probation_end_date: "2026-12-08",
        termination_date: null,
        status: "ONBOARDING",
        timezone: "America/New_York",
        work_email: "natalia.pena@winitlaw.com",
        slack_handle: "",
      },
      {
        id: "emp-16",
        person: "p-16",
        legal_entity: "le-1",
        employee_code: "W-1016",
        employment_type: "INTERN",
        work_mode: "HYBRID",
        hire_date: "2026-08-03",
        probation_end_date: null,
        termination_date: null,
        status: "TRAINING",
        timezone: "America/New_York",
        work_email: "tomas.aguirre@winitlaw.com",
        slack_handle: "@tom",
      },
      {
        id: "emp-17",
        person: "p-17",
        legal_entity: "le-1",
        employee_code: "W-1017",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2018-02-05",
        probation_end_date: "2018-05-05",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "renata.salcedo@winitlaw.com",
        slack_handle: "@renata",
      },
      {
        id: "emp-18",
        person: "p-18",
        legal_entity: "le-1",
        employee_code: "W-1018",
        employment_type: "FULL_TIME",
        work_mode: "HYBRID",
        hire_date: "2022-03-14",
        probation_end_date: "2022-06-14",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "carolina.duarte@winitlaw.com",
        slack_handle: "@caro",
      },
      {
        id: "emp-19",
        person: "p-19",
        legal_entity: "le-1",
        employee_code: "W-1019",
        employment_type: "FULL_TIME",
        work_mode: "ONSITE",
        hire_date: "2024-03-04",
        probation_end_date: "2024-06-04",
        termination_date: null,
        status: "ACTIVE",
        timezone: "America/New_York",
        work_email: "hector.molina@winitlaw.com",
        slack_handle: "@hector",
      },
    ],

    assignments: [
      {
        id: "as-1",
        employment: "emp-1",
        position: "pos-1",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2016-01-04",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-2",
        employment: "emp-2",
        position: "pos-2",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2017-03-06",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-3",
        employment: "emp-3",
        position: "pos-3",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2018-06-11",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-4",
        employment: "emp-4",
        position: "pos-4",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2019-02-04",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-5",
        employment: "emp-5",
        position: "pos-5",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2019-09-16",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-6",
        employment: "emp-6",
        position: "pos-6",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2026-04-06",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-7",
        employment: "emp-7",
        position: "pos-8",
        is_primary: true,
        fte_pct: "50.00",
        effective_from: "2022-07-11",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-8",
        employment: "emp-8",
        position: "pos-9",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2020-11-02",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-9",
        employment: "emp-9",
        position: "pos-10",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2021-05-17",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-10",
        employment: "emp-10",
        position: "pos-12",
        is_primary: true,
        fte_pct: "80.00",
        effective_from: "2023-01-09",
        effective_to: null,
        change_reason: "HIRE",
      },
      // Sofía's first seat, closed the day before her promotion took effect.
      {
        id: "as-11",
        employment: "emp-11",
        position: "pos-14",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2020-08-03",
        effective_to: "2024-01-01",
        change_reason: "HIRE",
      },
      {
        id: "as-12",
        employment: "emp-11",
        position: "pos-13",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2024-01-02",
        effective_to: null,
        change_reason: "PROMOTION",
      },
      {
        id: "as-13",
        employment: "emp-12",
        position: "pos-15",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2022-02-14",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-14",
        employment: "emp-13",
        position: "pos-16",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2023-08-07",
        effective_to: null,
        change_reason: "HIRE",
      },
      // Closed on termination, which is why pos-17 has no occupant.
      {
        id: "as-15",
        employment: "emp-14",
        position: "pos-17",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2021-10-04",
        effective_to: "2026-05-29",
        change_reason: "HIRE",
      },
      {
        id: "as-16",
        employment: "emp-16",
        position: "pos-11",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2026-08-03",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-17",
        employment: "emp-17",
        position: "pos-19",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2018-02-05",
        effective_to: null,
        change_reason: "HIRE",
      },
      {
        id: "as-18",
        employment: "emp-18",
        position: "pos-20",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2022-03-14",
        effective_to: null,
        change_reason: "HIRE",
      },
      // Backfills the NY seat Sofía left when she moved up to Sales level.
      {
        id: "as-19",
        employment: "emp-19",
        position: "pos-14",
        is_primary: true,
        fte_pct: "100.00",
        effective_from: "2024-03-04",
        effective_to: null,
        change_reason: "HIRE",
      },
    ],

    users: [
      {
        id: "usr-1",
        email: "admin@winitlaw.com",
        password: "mockpass",
        person: null,
        status: "ACTIVE",
        auth_provider: "LOCAL",
        mfa_enabled: true,
        is_staff: true,
        is_superuser: true,
        last_login_at: "2026-08-14T08:12:04Z",
        date_joined: "2016-01-04T00:00:00Z",
        roles: [{ code: "SUPERUSER", scope_type: "GLOBAL", scope_id: null }],
        permissions: ["*"],
      },
      {
        id: "usr-2",
        email: "ricardo.salazar@winitlaw.com",
        password: "mockpass",
        person: "p-1",
        status: "ACTIVE",
        auth_provider: "OIDC",
        mfa_enabled: true,
        is_staff: false,
        is_superuser: false,
        last_login_at: "2026-08-13T19:44:10Z",
        date_joined: "2016-01-04T00:00:00Z",
        roles: [{ code: "EXECUTIVE", scope_type: "GLOBAL", scope_id: null }],
        permissions: [
          "directory.view",
          "person.view",
          "employment.view",
          "orgunit.view",
          "position.view",
          "headcount.view",
          "auditevent.view",
        ],
      },
      {
        id: "usr-3",
        email: "mariana.vargas@winitlaw.com",
        password: "mockpass",
        person: "p-2",
        status: "ACTIVE",
        auth_provider: "LOCAL",
        mfa_enabled: true,
        is_staff: true,
        is_superuser: false,
        last_login_at: "2026-08-14T07:02:55Z",
        date_joined: "2017-03-06T00:00:00Z",
        roles: [{ code: "HR_ADMIN", scope_type: "GLOBAL", scope_id: null }],
        permissions: [
          "directory.view",
          "person.view",
          "person.change",
          "employment.view",
          "employment.change",
          "orgunit.view",
          "orgunit.change",
          "position.view",
          "position.change",
          "user.view",
          "user.change",
          "headcount.view",
          "auditevent.view",
        ],
      },
      {
        id: "usr-4",
        email: "javier.montoya@winitlaw.com",
        password: "mockpass",
        person: "p-3",
        status: "ACTIVE",
        auth_provider: "OIDC",
        mfa_enabled: false,
        is_staff: false,
        is_superuser: false,
        last_login_at: "2026-08-12T15:31:02Z",
        date_joined: "2018-06-11T00:00:00Z",
        roles: [{ code: "MANAGER", scope_type: "ORG_UNIT", scope_id: "ou-4" }],
        permissions: [
          "directory.view",
          "employment.view",
          "orgunit.view",
          "position.view",
          "headcount.view",
        ],
      },
      {
        id: "usr-5",
        email: "camila.restrepo@winitlaw.com",
        password: "mockpass",
        person: "p-4",
        status: "ACTIVE",
        auth_provider: "OIDC",
        mfa_enabled: false,
        is_staff: false,
        is_superuser: false,
        last_login_at: "2026-08-11T10:08:47Z",
        date_joined: "2019-02-04T00:00:00Z",
        roles: [{ code: "MANAGER", scope_type: "ORG_UNIT", scope_id: "ou-5" }],
        permissions: [
          "directory.view",
          "employment.view",
          "orgunit.view",
          "position.view",
          "headcount.view",
        ],
      },
      // Invited but never signed in — "Can sign in" is ✗ for anything but ACTIVE.
      {
        id: "usr-6",
        email: "andres.quintero@winitlaw.com",
        password: "mockpass",
        person: "p-5",
        status: "PENDING",
        auth_provider: "OIDC",
        mfa_enabled: false,
        is_staff: false,
        is_superuser: false,
        last_login_at: null,
        date_joined: "2026-08-01T00:00:00Z",
        roles: [{ code: "EMPLOYEE", scope_type: "GLOBAL", scope_id: null }],
        permissions: ["directory.view", "orgunit.view"],
      },
      // No person attached: this is what a service account looks like.
      {
        id: "usr-7",
        email: "integrations@winitlaw.com",
        password: "mockpass",
        person: null,
        status: "ACTIVE",
        auth_provider: "LOCAL",
        mfa_enabled: false,
        is_staff: false,
        is_superuser: false,
        last_login_at: "2026-08-14T06:00:12Z",
        date_joined: "2023-02-14T00:00:00Z",
        roles: [{ code: "INTEGRATION", scope_type: "GLOBAL", scope_id: null }],
        permissions: ["directory.view", "employment.view"],
      },
      // Disabled when the employment was terminated.
      {
        id: "usr-8",
        email: "gabriel.ocampo@winitlaw.com",
        password: "mockpass",
        person: "p-14",
        status: "DISABLED",
        auth_provider: "LOCAL",
        mfa_enabled: false,
        is_staff: false,
        is_superuser: false,
        last_login_at: "2026-05-29T16:22:38Z",
        date_joined: "2021-10-04T00:00:00Z",
        roles: [],
        permissions: [],
      },
    ],

    auditEvents: [
      {
        id: "ev-1",
        actor_email: "admin@winitlaw.com",
        action: "auth.signed_in",
        subject_type: "user",
        subject_id: "usr-1",
        occurred_at: "2026-08-14T08:12:04Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-2",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "employment.status_changed",
        subject_type: "employment",
        subject_id: "emp-16",
        occurred_at: "2026-08-13T16:41:22Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-3",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "employment.created",
        subject_type: "employment",
        subject_id: "emp-16",
        occurred_at: "2026-08-13T15:02:11Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-4",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "person.created",
        subject_type: "person",
        subject_id: "p-16",
        occurred_at: "2026-08-13T14:55:03Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-5",
        actor_email: "admin@winitlaw.com",
        action: "position.created",
        subject_type: "position",
        subject_id: "pos-11",
        occurred_at: "2026-08-12T11:20:47Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-6",
        actor_email: "camila.restrepo@winitlaw.com",
        action: "position.updated",
        subject_type: "position",
        subject_id: "pos-18",
        occurred_at: "2026-08-11T09:33:12Z",
        ip: "68.174.20.55",
      },
      {
        id: "ev-7",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "employment.created",
        subject_type: "employment",
        subject_id: "emp-15",
        occurred_at: "2026-08-10T17:04:59Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-8",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "person.created",
        subject_type: "person",
        subject_id: "p-15",
        occurred_at: "2026-08-10T16:58:31Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-9",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "employment.status_changed",
        subject_type: "employment",
        subject_id: "emp-14",
        occurred_at: "2026-05-29T10:02:18Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-10",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "user.status_changed",
        subject_type: "user",
        subject_id: "usr-8",
        occurred_at: "2026-05-29T18:44:07Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-11",
        actor_email: "mariana.vargas@winitlaw.com",
        action: "position.updated",
        subject_type: "position",
        subject_id: "pos-17",
        occurred_at: "2026-05-29T18:40:55Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-12",
        actor_email: "admin@winitlaw.com",
        action: "org_unit.created",
        subject_type: "org_unit",
        subject_id: "ou-13",
        occurred_at: "2026-04-20T13:15:40Z",
        ip: "72.229.31.184",
      },
      {
        id: "ev-13",
        actor_email: "javier.montoya@winitlaw.com",
        action: "employment.created",
        subject_type: "employment",
        subject_id: "emp-6",
        occurred_at: "2026-04-06T09:01:29Z",
        ip: "68.174.20.55",
      },
      // Actor null: the acting account was deleted afterwards, which the Audit
      // screen renders as "system".
      {
        id: "ev-14",
        actor_email: null,
        action: "person.created",
        subject_type: "person",
        subject_id: "p-6",
        occurred_at: "2026-04-06T08:57:03Z",
        ip: null,
      },
    ],

    // Filled in below: generated rather than written out, because a month of
    // incidents across nineteen people is a thousand lines of noise.
    attendance: [],
  }

  db.attendance = attendanceFor(db.employments)
  return db
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/** How far back incidents are generated. A month view plus slack. */
const ATTENDANCE_DAYS = 45

/**
 * A stable 0..1 from a string.
 *
 * Deterministic on purpose: the same key gives the same value on every reload,
 * so the strip does not reshuffle itself between refreshes and a screenshot
 * still matches tomorrow. It is not random and must never be used for anything
 * that needs to be.
 */
function roll(key: string): number {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 100_000) / 100_000
}

const LATE_REASONS: Record<string, string[]> = {
  UNEXCUSED: ["No notice given", "Overslept", "Did not call in"],
  EXCUSED: ["Traffic on the bridge", "Train delay", "Notified the manager"],
  JUSTIFIED: ["Medical appointment", "Court appearance", "Family emergency"],
}

const EARLY_REASONS: Record<string, string[]> = {
  UNEXCUSED: ["Left without notice", "Unlogged departure"],
  EXCUSED: ["Childcare pickup", "Approved by the manager"],
  JUSTIFIED: ["Medical appointment", "Bereavement", "Pre-approved leave"],
}

const ABSENCE_REASONS: Record<string, string[]> = {
  UNEXCUSED: ["No show", "Did not call in", "Unreported absence"],
  EXCUSED: ["Called in sick", "Notified the manager"],
  JUSTIFIED: ["Medical certificate", "Bereavement leave", "Jury duty"],
}

/** Minutes for a bracket, so every one of the six is represented. */
const MINUTE_STEPS = [12, 24, 47, 95, 160, 220]

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/**
 * Generate the incident log for the window ending today.
 *
 * Weekends are skipped, and so is anything outside the employment's own dates —
 * a future hire and a terminated employment both come back with no rows, which
 * is what makes the "outside the employment" state visible on the strip.
 */
function attendanceFor(employments: EmploymentRow[]): AttendanceEventRow[] {
  const events: AttendanceEventRow[] = []
  const today = new Date()
  let sequence = 0

  for (const employment of employments) {
    // Punctuality is a property of the person, not of the day, so one badly
    // behaved employee shows a visibly worse row than everyone else. Cubed to
    // skew the company heavily punctual: most rows should read as a wall of
    // green, or a bad week stops standing out.
    const proneness = roll(`${employment.id}:proneness`) ** 3

    for (let back = ATTENDANCE_DAYS - 1; back >= 0; back -= 1) {
      const day = new Date(today)
      day.setDate(day.getDate() - back)
      const date = isoDate(day)
      const weekend = day.getDay() === 0 || day.getDay() === 6

      // Weekends are workable — agents pay hours back on a Saturday — and
      // whether someone comes in has nothing to do with how punctual they are,
      // so this gate ignores proneness. Rare, so a weekend bar reads as the
      // exception it is. With no hours model yet, an incident is the only
      // evidence a day was worked, so a seeded weekend always carries one.
      if (weekend) {
        if (roll(`${employment.id}:${date}:weekend`) > 0.05) continue
        const key = `${employment.id}:${date}:WEEKEND_SHIFT`
        const type = roll(`${key}:type`) < 0.7 ? "LATE_ARRIVAL" : "EARLY_LEAVE"
        const justification =
          roll(`${key}:just`) < 0.4
            ? "UNEXCUSED"
            : roll(`${key}:just2`) < 0.6
              ? "EXCUSED"
              : "JUSTIFIED"
        const pool = (type === "LATE_ARRIVAL" ? LATE_REASONS : EARLY_REASONS)[
          justification
        ]!
        sequence += 1
        events.push({
          id: `att-${sequence}`,
          employment: employment.id,
          date,
          type,
          minutes: MINUTE_STEPS[Math.floor(roll(`${key}:mins`) * MINUTE_STEPS.length)] ?? 12,
          justification,
          reason: pool[Math.floor(roll(`${key}:why`) * pool.length)] ?? pool[0]!,
        })
        continue
      }
      if (date < employment.hire_date) continue
      if (employment.termination_date && date > employment.termination_date) continue

      // Even the worst offender keeps roughly three days in four.
      const chance = proneness * 0.35

      // A full day missed is the rarest of the three, and it stands alone:
      // nobody arrives late to a day they never worked.
      const absenceKey = `${employment.id}:${date}:ABSENCE`
      if (roll(absenceKey) < chance * 0.34) {
        const justification =
          roll(`${absenceKey}:just`) < 0.3
            ? "UNEXCUSED"
            : roll(`${absenceKey}:just2`) < 0.5
              ? "EXCUSED"
              : "JUSTIFIED"
        const pool = ABSENCE_REASONS[justification]!
        sequence += 1
        events.push({
          id: `att-${sequence}`,
          employment: employment.id,
          date,
          type: "ABSENCE",
          minutes: null,
          justification,
          reason: pool[Math.floor(roll(`${absenceKey}:why`) * pool.length)] ?? pool[0]!,
        })
        continue
      }

      for (const type of ["LATE_ARRIVAL", "EARLY_LEAVE"] as const) {
        const key = `${employment.id}:${date}:${type}`
        // Leaving early is rarer than arriving late.
        const weight = type === "LATE_ARRIVAL" ? 1 : 0.4
        if (roll(key) >= chance * weight) continue

        const justification =
          roll(`${key}:just`) < 0.45
            ? "UNEXCUSED"
            : roll(`${key}:just2`) < 0.6
              ? "EXCUSED"
              : "JUSTIFIED"
        const minutes =
          MINUTE_STEPS[Math.floor(roll(`${key}:mins`) * MINUTE_STEPS.length)] ?? 12
        const pool = (type === "LATE_ARRIVAL" ? LATE_REASONS : EARLY_REASONS)[
          justification
        ]!
        sequence += 1

        events.push({
          id: `att-${sequence}`,
          employment: employment.id,
          date,
          type,
          minutes,
          justification,
          reason: pool[Math.floor(roll(`${key}:why`) * pool.length)] ?? pool[0]!,
        })
      }
    }
  }

  return events
}
