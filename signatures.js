// Store all safety records in localStorage
const RECORDS_KEY = "staff-safety-records-v1";

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

// Record ID: docName + "|" + date
function makeRecordId(name, date) {
  return `${date}|${name}`;
}

let records = loadRecords();
let activeRecordId = null;

// UI helpers
function setRecordMessage(text, type) {
  const el = document.getElementById("recordMessage");
  el.textContent = text || "";
  el.className = "message";
  if (!text) return;
  if (type === "error") el.classList.add("error");
  if (type === "success") el.classList.add("success");
}

function setSignMessage(text, type) {
  const el = document.getElementById("signMessage");
  el.textContent = text || "";
  el.className = "message";
  if (!text) return;
  if (type === "error") el.classList.add("error");
  if (type === "success") el.classList.add("success");
}

// Populate driver dropdown from BASE_DRIVERS (from drivers.js)
function populateDriversSelect() {
  const select = document.getElementById("driverPicker");

  while (select.options.length > 1) {
    select.remove(1);
  }

  const sorted = [...BASE_DRIVERS].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );

  sorted.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.staffNumber; // unique
    opt.textContent = d.name;
    select.appendChild(opt);
  });
}

function findDriverByStaffNumber(staffNumber) {
  return BASE_DRIVERS.find((d) => d.staffNumber === staffNumber);
}

// Fill existing records dropdown
function refreshRecordsSelect() {
  const select = document.getElementById("existingRecords");

  // keep placeholder
  while (select.options.length > 1) {
    select.remove(1);
  }

  const entries = Object.values(records).sort((a, b) => {
    // newest first by date
    if (a.date === b.date) {
      return a.name.localeCompare(b.name);
    }
    return a.date < b.date ? 1 : -1;
  });

  entries.forEach((rec) => {
    const opt = document.createElement("option");
    opt.value = rec.id;
    opt.textContent = `${rec.date} – ${rec.name}`;
    select.appendChild(opt);
  });

  if (activeRecordId && records[activeRecordId]) {
    select.value = activeRecordId;
  } else {
    select.value = "";
  }
}

// Update header + table for active record
function refreshActiveRecordUI() {
  const info = document.getElementById("activeRecordInfo");
  const signingSection = document.getElementById("signingSection");
  const counter = document.getElementById("signCounter");
  const tbody = document.getElementById("signatureTableBody");
  const exportBtn = document.getElementById("exportPdfBtn");

  const record = activeRecordId ? records[activeRecordId] : null;

  if (!record) {
    info.textContent =
      "No active record yet. Enter a document/PPE name above to start.";
    signingSection.style.display = "none";
    exportBtn.disabled = true;
    return;
  }

  info.textContent = `Active record: “${record.name}” on ${record.date}`;
  signingSection.style.display = "block";

  // table
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  if (!record.signatures || record.signatures.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "No signatures yet for this record.";
    td.className = "muted";
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    const sortedSigs = [...record.signatures].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );

    sortedSigs.forEach((sig) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = sig.name;

      const tdStaff = document.createElement("td");
      tdStaff.textContent = sig.staffNumber;

      const tdTime = document.createElement("td");
      const dt = new Date(sig.timestamp);
      tdTime.textContent = isNaN(dt.getTime())
        ? sig.timestamp
        : dt.toLocaleString();

      tr.appendChild(tdName);
      tr.appendChild(tdStaff);
      tr.appendChild(tdTime);

      tbody.appendChild(tr);
    });
  }

  const totalDrivers = BASE_DRIVERS.length;
  const signedCount = record.signatures ? record.signatures.length : 0;
  counter.textContent = `${signedCount} of ${totalDrivers} drivers recorded for this document.`;

  exportBtn.disabled = signedCount === 0;
}

// Create or load a record from inputs
function handleLoadRecord() {
  setRecordMessage("");
  setSignMessage("");

  const nameInput = document.getElementById("docName");
  const dateInput = document.getElementById("docDate");

  const name = nameInput.value.trim();
  let date = dateInput.value;

  if (!name) {
    setRecordMessage("Please enter a document or PPE name.", "error");
    return;
  }

  if (!date) {
    // default to today's date
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    date = `${yyyy}-${mm}-${dd}`;
    dateInput.value = date;
  }

  const id = makeRecordId(name, date);
  let record = records[id];

  if (!record) {
    record = {
      id,
      name,
      date,
      createdAt: new Date().toISOString(),
      signatures: [],
    };
    records[id] = record;
    saveRecords(records);
    setRecordMessage("New record created.", "success");
  } else {
    setRecordMessage("Existing record loaded.", "success");
  }

  activeRecordId = id;
  refreshRecordsSelect();
  refreshActiveRecordUI();
}

// Load record from existing dropdown
function handleSelectExistingRecord() {
  setRecordMessage("");
  setSignMessage("");

  const select = document.getElementById("existingRecords");
  const id = select.value;
  if (!id) return;

  if (!records[id]) {
    setRecordMessage("Record not found.", "error");
    return;
  }

  activeRecordId = id;

  const record = records[id];
  document.getElementById("docName").value = record.name;
  document.getElementById("docDate").value = record.date;

  refreshRecordsSelect();
  refreshActiveRecordUI();
  setRecordMessage("Existing record loaded.", "success");
}

// Mark a driver as signed for current record
function handleMarkReceived() {
  setSignMessage("");

  if (!activeRecordId || !records[activeRecordId]) {
    setSignMessage("Please load or create a record first.", "error");
    return;
  }

  const record = records[activeRecordId];
  const select = document.getElementById("driverPicker");
  const staffNumber = select.value;

  if (!staffNumber) {
    setSignMessage("Please choose a driver.", "error");
    return;
  }

  const driver = findDriverByStaffNumber(staffNumber);
  if (!driver) {
    setSignMessage("Driver not found in base list.", "error");
    return;
  }

  record.signatures = record.signatures || [];

  const existingIndex = record.signatures.findIndex(
    (s) => s.staffNumber === staffNumber
  );

  const nowIso = new Date().toISOString();

  if (existingIndex >= 0) {
    // already signed – update timestamp
    record.signatures[existingIndex].timestamp = nowIso;
    setSignMessage(
      `${driver.name} was already recorded. Time updated to now.`,
      "success"
    );
  } else {
    record.signatures.push({
      staffNumber,
      name: driver.name,
      timestamp: nowIso,
    });
    setSignMessage(`${driver.name} marked as received & signed.`, "success");
  }

  saveRecords(records);
  refreshActiveRecordUI();
}

// Export current record to PDF
function handleExportPdf() {
  if (!activeRecordId || !records[activeRecordId]) return;

  const record = records[activeRecordId];
  if (!record.signatures || record.signatures.length === 0) {
    setSignMessage("No signatures to export.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    setSignMessage("PDF library not loaded. Please check your connection.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Safety / PPE Receipt Record", 10, 12);
  doc.setFontSize(11);
  doc.text(`Document/PPE: ${record.name}`, 10, 20);
  doc.text(`Date: ${record.date}`, 10, 26);

  doc.setFontSize(10);
  let y = 38;

  doc.text("Driver", 10, y);
  doc.text("Staff no.", 80, y);
  doc.text("Time recorded", 120, y);
  y += 6;

  const sortedSigs = [...record.signatures].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );

  sortedSigs.forEach((sig) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    const dt = new Date(sig.timestamp);
    const timeStr = isNaN(dt.getTime())
      ? sig.timestamp
      : dt.toLocaleString();

    doc.text(sig.name, 10, y);
    doc.text(sig.staffNumber, 80, y);
    doc.text(timeStr, 120, y);

    y += 6;
  });

  const safeName = record.name.replace(/[^\w\-]+/g, "-");
  const filename = `safety-${record.date}-${safeName}.pdf`;

  doc.save(filename);
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  // Default date to today
  const dateInput = document.getElementById("docDate");
  if (dateInput && !dateInput.value) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  populateDriversSelect();
  refreshRecordsSelect();
  refreshActiveRecordUI();

  document
    .getElementById("loadRecordBtn")
    .addEventListener("click", handleLoadRecord);

  document
    .getElementById("existingRecords")
    .addEventListener("change", handleSelectExistingRecord);

  document
    .getElementById("markReceivedBtn")
    .addEventListener("click", handleMarkReceived);

  document
    .getElementById("exportPdfBtn")
    .addEventListener("click", handleExportPdf);
});
