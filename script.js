"use strict";


// MOODCANVAS — MAIN APPLICATION

const $ = (selector) => document.querySelector(selector);

const moodInfo = {
  Happy:   { emoji: "☀️", color: "#f6d5e2" },
  Calm:    { emoji: "🌿", color: "#cfe8d5" },
  Excited: { emoji: "✨", color: "#f8e4a6" },
  Sad:     { emoji: "🌧️", color: "#cfdafa" },
  Tired:   { emoji: "🌙", color: "#ddd1f4" },
  Anxious: { emoji: "🫧", color: "#f5d1bf" }
};

const STORAGE_KEY = "moodcanvas_entries";

let entries = [];
let selectedMood = "Happy";
let editingId = null;
let selectedDate = null;
let viewedMonth = new Date();
viewedMonth.setDate(1);


// DATE HELPERS
// Use local dates so calendar days match
// the user's local calendar.


function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseEntryDate(entry) {
  // New entries always have a local dateKey.
  if (entry.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(entry.dateKey)) {
    const [year, month, day] = entry.dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  // Migrate entries saved by the earlier app version.
  // Prefer the old displayed local date when it exists.
  if (entry.date) {
    const oldDate = new Date(entry.date);

    if (!Number.isNaN(oldDate.getTime())) {
      return oldDate;
    }
  }

  // Last fallback for older entries.
  if (entry.dateISO) {
    const oldISO = new Date(entry.dateISO);

    if (!Number.isNaN(oldISO.getTime())) {
      return oldISO;
    }
  }

  return new Date();
}

function formatDate(date) {
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getEntryDateKey(entry) {
  return localDateKey(parseEntryDate(entry));
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}


// LOAD AND SAVE DATA


function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(entry =>
        entry &&
        typeof entry === "object" &&
        typeof entry.note === "string" &&
        moodInfo[entry.mood]
      )
      .map(entry => ({
        id: String(entry.id || crypto.randomUUID()),
        mood: entry.mood,
        note: entry.note,
        color: /^#[0-9a-f]{6}$/i.test(entry.color)
          ? entry.color
          : moodInfo[entry.mood].color,
        dateKey: entry.dateKey || localDateKey(parseEntryDate(entry)),
        createdAt: Number(entry.createdAt) || parseEntryDate(entry).getTime()
      }));
  } catch (error) {
    console.error("Could not load MoodCanvas entries:", error);
    return [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    console.error("Could not save MoodCanvas entries:", error);
    showMessage(
      "Your browser could not save the changes. Check available storage.",
      true
    );
    return false;
  }
}

entries = loadEntries();

// MOOD PICKER AND COLOR PICKER


$("#mood-options").addEventListener("click", event => {
  const button = event.target.closest("[data-mood]");

  if (!button) return;

  selectedMood = button.dataset.mood;

  document.querySelectorAll(".mood-option").forEach(option => {
    option.classList.toggle("selected", option === button);
  });

  if (!editingId) {
    $("#color").value = moodInfo[selectedMood].color;
    updateColorPreview();
  }

  showMessage("");
});

$("#color").addEventListener("input", updateColorPreview);

function updateColorPreview() {
  $("#color-preview").style.backgroundColor = $("#color").value;
}

$("#note").addEventListener("input", () => {
  $("#char-count").textContent = `${$("#note").value.length} / 300`;
});

// ======================================
// SAVE AND EDIT ENTRIES
// ======================================

$("#save").addEventListener("click", saveEntry);

function saveEntry() {
  const note = $("#note").value.trim();

  if (!note) {
    showMessage("Write a little note before saving ♡", true);
    $("#note").focus();
    return;
  }

  const color = $("#color").value;
  const now = Date.now();

  if (editingId) {
    const index = entries.findIndex(entry => entry.id === editingId);

    if (index === -1) {
      resetForm();
      showMessage("That memory could not be found. Try again.", true);
      return;
    }

    const previous = entries[index];

    entries[index] = {
      ...previous,
      mood: selectedMood,
      note,
      color,
      updatedAt: now
    };

    if (!saveEntries()) {
      entries[index] = previous;
      return;
    }

    showMessage("Your memory has been updated ♡");
  } else {
    const entry = {
      id: crypto.randomUUID(),
      mood: selectedMood,
      note,
      color,
      dateKey: localDateKey(),
      createdAt: now
    };

    entries.unshift(entry);

    if (!saveEntries()) {
      entries.shift();
      return;
    }

    // Show today's new entry in the calendar.
    selectedDate = entry.dateKey;
    viewedMonth = parseEntryDate(entry);
    viewedMonth.setDate(1);

    showMessage("A little memory has been saved ✿");
  }

  resetForm();
  renderAll();
}

function startEditing(id) {
  const entry = entries.find(item => item.id === id);

  if (!entry) return;

  editingId = id;
  selectedMood = entry.mood;

  $("#note").value = entry.note;
  $("#color").value = entry.color;
  $("#char-count").textContent = `${entry.note.length} / 300`;

  document.querySelectorAll(".mood-option").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.mood === selectedMood
    );
  });

  $("#form-title").textContent = "Edit this little memory";
  $("#save").innerHTML = "Update my moment <span>↗</span>";
  $("#cancel-edit").hidden = false;

  updateColorPreview();
  showMessage("Make your changes and save when you're ready.");
  $("#create").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#note").focus({ preventScroll: true });
}

function resetForm() {
  editingId = null;
  selectedMood = "Happy";

  $("#note").value = "";
  $("#color").value = moodInfo.Happy.color;
  $("#char-count").textContent = "0 / 300";
  $("#form-title").textContent = "How are you, really?";
  $("#save").innerHTML = 'Save my moment <span>↗</span>';
  $("#cancel-edit").hidden = true;

  document.querySelectorAll(".mood-option").forEach(button => {
    button.classList.toggle("selected", button.dataset.mood === "Happy");
  });

  updateColorPreview();
}

$("#cancel-edit").addEventListener("click", () => {
  resetForm();
  showMessage("Editing cancelled.");
});

// DELETE ENTRIES


$("#cards").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    startEditing(id);
    return;
  }

  if (action === "delete") {
    const entry = entries.find(item => item.id === id);

    if (!entry) return;

    const confirmed = window.confirm(
      "Delete this mood memory? This cannot be undone."
    );

    if (!confirmed) return;

    const previousEntries = entries;
    entries = entries.filter(item => item.id !== id);

    if (!saveEntries()) {
      entries = previousEntries;
      return;
    }

    if (editingId === id) resetForm();

    showMessage("Memory removed from your collection.");
    renderAll();
  }
});

// SEARCH, FILTER, AND SORT


$("#filter").addEventListener("change", renderCollection);
$("#search").addEventListener("input", renderCollection);
$("#sort").addEventListener("change", renderCollection);

function getVisibleEntries() {
  let visible = [...entries];

  const mood = $("#filter").value;
  const search = $("#search").value.trim().toLowerCase();

  if (mood !== "All") {
    visible = visible.filter(entry => entry.mood === mood);
  }

  if (selectedDate) {
    visible = visible.filter(
      entry => getEntryDateKey(entry) === selectedDate
    );
  }

  if (search) {
    visible = visible.filter(entry =>
      entry.note.toLowerCase().includes(search) ||
      entry.mood.toLowerCase().includes(search)
    );
  }

  visible.sort((a, b) => {
    const difference = a.createdAt - b.createdAt;
    return $("#sort").value === "oldest" ? difference : -difference;
  });

  return visible;
}

$("#reset-filter").addEventListener("click", () => {
  $("#filter").value = "All";
  $("#search").value = "";
  $("#sort").value = "newest";
  selectedDate = null;
  renderAll();
});

$("#clear-day-filter").addEventListener("click", () => {
  selectedDate = null;
  renderAll();

  $("#collection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

$("#empty-action").addEventListener("click", () => {
  $("#create").scrollIntoView({ behavior: "smooth" });
  $("#note").focus({ preventScroll: true });
});


// COLLECTION RENDERING


function renderCollection() {
  const container = $("#cards");
  const visible = getVisibleEntries();

  container.replaceChildren();
  $("#count").textContent = visible.length;

  const filtersActive =
    $("#filter").value !== "All" ||
    $("#search").value.trim() !== "" ||
    selectedDate !== null;

  $("#reset-filter").hidden = !filtersActive;

  $("#collection-subtitle").textContent = selectedDate
    ? `Memories from ${selectedDate}`
    : filtersActive
      ? "Here are the memories matching your filters."
      : "Every memory deserves a place.";

  $("#empty").hidden = visible.length > 0;

  if (!visible.length) {
    $("#empty-title").textContent = entries.length
      ? "No memories found"
      : "Your canvas is waiting";

    $("#empty-text").textContent = entries.length
      ? "Try a different mood, date, or search."
      : "Save your first little moment and watch your world of colors grow.";
  }

  visible.forEach(entry => {
    const info = moodInfo[entry.mood];

    const card = document.createElement("article");
    card.className = "memory-card";

    const strip = document.createElement("div");
    strip.className = "memory-color";
    strip.style.backgroundColor = entry.color;

    const body = document.createElement("div");
    body.className = "memory-body";

    const meta = document.createElement("div");
    meta.className = "memory-meta";

    const mood = document.createElement("span");
    mood.className = "memory-mood";
    mood.textContent = `${info.emoji} ${entry.mood}`;

    const date = document.createElement("span");
    date.className = "memory-date";
    date.textContent = formatDate(parseEntryDate(entry));

    meta.append(mood, date);

    const note = document.createElement("p");
    note.className = "memory-note";
    note.textContent = entry.note;

    const actions = document.createElement("div");
    actions.className = "memory-actions";

    const edit = document.createElement("button");
    edit.className = "memory-action";
    edit.textContent = "✎ Edit";
    edit.dataset.action = "edit";
    edit.dataset.id = entry.id;
    edit.type = "button";

    const remove = document.createElement("button");
    remove.className = "memory-action delete";
    remove.textContent = "× Delete";
    remove.dataset.action = "delete";
    remove.dataset.id = entry.id;
    remove.type = "button";

    actions.append(edit, remove);
    body.append(meta, note, actions);
    card.append(strip, body);
    container.append(card);
  });
}


// CALENDAR

$("#prev-month").addEventListener("click", () => {
  viewedMonth = new Date(
    viewedMonth.getFullYear(),
    viewedMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

$("#next-month").addEventListener("click", () => {
  viewedMonth = new Date(
    viewedMonth.getFullYear(),
    viewedMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

$("#today-button").addEventListener("click", () => {
  const today = new Date();
  viewedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = localDateKey(today);
  renderAll();
});

function renderCalendar() {
  const grid = $("#calendar");
  grid.replaceChildren();

  ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].forEach(day => {
    const heading = document.createElement("span");
    heading.className = "weekday";
    heading.textContent = day;
    grid.append(heading);
  });

  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();

  $("#calendar-month").textContent = viewedMonth.toLocaleDateString("en", {
    month: "long",
    year: "numeric"
  });

  const firstWeekday = new Date(year, month, 1).getDay();
  const numberOfDays = new Date(year, month + 1, 0).getDate();
  const todayKey = localDateKey();

  // Leading empty squares.
  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement("span");
    blank.className = "calendar-day outside";
    blank.setAttribute("aria-hidden", "true");
    grid.append(blank);
  }

  for (let day = 1; day <= numberOfDays; day++) {
    const date = new Date(year, month, day);
    const key = localDateKey(date);

    const dayEntries = entries.filter(
      entry => getEntryDateKey(entry) === key
    );

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = day;
    button.setAttribute("aria-label", `${formatDate(date)}, ${dayEntries.length} memories`);

    if (key === todayKey) button.classList.add("today");
    if (key === selectedDate) button.classList.add("selected-day");

    if (dayEntries.length) {
      button.classList.add("has-entry");
      button.style.backgroundColor = dayEntries[0].color;
      button.title = `${dayEntries.length} saved ${dayEntries.length === 1 ? "memory" : "memories"}`;

      const emoji = document.createElement("span");
      emoji.className = "day-emoji";
      emoji.textContent = moodInfo[dayEntries[0].mood].emoji;
      button.append(emoji);

      if (dayEntries.length > 1) {
        const count = document.createElement("span");
        count.className = "day-count";
        count.textContent = `${dayEntries.length} saved`;
        button.append(count);
      }
    }

    button.addEventListener("click", () => {
      selectedDate = key;
      showDayDetails(key, dayEntries);
      renderCalendar();
      renderCollection();

      $("#clear-day-filter").hidden = false;
    });

    grid.append(button);
  }

  // Trailing empty squares keep the calendar rectangular.
  const totalSquares = firstWeekday + numberOfDays;
  const trailing = (7 - totalSquares % 7) % 7;

  for (let i = 0; i < trailing; i++) {
    const blank = document.createElement("span");
    blank.className = "calendar-day outside";
    blank.setAttribute("aria-hidden", "true");
    grid.append(blank);
  }

  if (selectedDate) {
    const selectedEntries = entries.filter(
      entry => getEntryDateKey(entry) === selectedDate
    );
    showDayDetails(selectedDate, selectedEntries);
  } else {
    $("#day-detail-title").textContent = "Choose a day";
    $("#day-detail-text").textContent =
      "Your saved moments will appear here when you select a date.";
    $("#day-detail-icon").textContent = "♡";
    $("#clear-day-filter").hidden = true;
  }
}

function showDayDetails(key, dayEntries) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  $("#day-detail-title").textContent = formatDate(date);
  $("#day-detail-icon").textContent = dayEntries.length
    ? moodInfo[dayEntries[0].mood].emoji
    : "♡";

  if (!dayEntries.length) {
    $("#day-detail-text").textContent =
      "No saved memories on this day. Maybe there's room for one today.";
    return;
  }

  $("#day-detail-text").textContent = dayEntries
    .map(entry => `${moodInfo[entry.mood].emoji} ${entry.mood}: ${entry.note}`)
    .join("\n");
}

// MOOD INSIGHTS


function renderInsights() {
  const now = new Date();
  const thisMonth = getMonthKey(now);

  $("#total-count").textContent = entries.length;

  const monthEntries = entries.filter(
    entry => getEntryDateKey(entry).startsWith(thisMonth)
  );

  $("#month-count").textContent = monthEntries.length;

  if (!entries.length) {
    $("#top-mood").textContent = "—";
    $("#top-mood-note").textContent = "your story starts here";
  } else {
    const counts = {};

    entries.forEach(entry => {
      counts[entry.mood] = (counts[entry.mood] || 0) + 1;
    });

    const top = Object.keys(counts).sort(
      (a, b) => counts[b] - counts[a]
    )[0];

    $("#top-mood").textContent = `${moodInfo[top].emoji} ${top}`;
    $("#top-mood-note").textContent =
      `${counts[top]} ${counts[top] === 1 ? "memory" : "memories"} recorded`;
  }

  const breakdown = $("#mood-breakdown");
  breakdown.replaceChildren();

  Object.entries(moodInfo).forEach(([mood, info]) => {
    const count = entries.filter(entry => entry.mood === mood).length;
    const percentage = entries.length
      ? Math.round((count / entries.length) * 100)
      : 0;

    const row = document.createElement("div");
    row.className = "breakdown-row";

    const label = document.createElement("div");
    label.className = "breakdown-label";

    const left = document.createElement("span");
    left.textContent = `${info.emoji} ${mood}`;

    const right = document.createElement("span");
    right.textContent = `${count} · ${percentage}%`;

    label.append(left, right);

    const track = document.createElement("div");
    track.className = "breakdown-track";

    const fill = document.createElement("div");
    fill.className = "breakdown-fill";
    fill.style.width = `${percentage}%`;
    fill.style.backgroundColor = info.color;

    track.append(fill);
    row.append(label, track);
    breakdown.append(row);
  });
}


// SHARED UI HELPERS


function showMessage(text, isError = false) {
  $("#message").textContent = text;
  $("#message").style.color = isError ? "#b65d76" : "#52866c";
}

function renderAll() {
  renderInsights();
  renderCalendar();
  renderCollection();
}

// START APPLICATION


updateColorPreview();
renderAll();
