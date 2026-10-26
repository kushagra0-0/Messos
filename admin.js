function load(key) {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) : [];
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function showSummary() {
  const students = load("messos_users").filter(u => u.role === "student");
  const optedIn = load("messos_optins").filter(o => o.optedIn);
  const served = load("messos_ledger").filter(l => l.result === "accepted");

  document.getElementById("numStudents").textContent = students.length;
  document.getElementById("numMeals").textContent = load("messos_slots").length;
  document.getElementById("numOptedIn").textContent = optedIn.length;
  document.getElementById("numServed").textContent = served.length;
}


}

function showMeals() {
  const slots = load("messos_slots").sort((a, b) =>
    (a.date + a.startTime).localeCompare(b.date + b.startTime)
  );
  const rows = slots.map(slot => `
    <tr>
      <td>${slot.date}</td>
      <td>${slot.mealType}</td>
      <td>${slot.items}</td>
      <td>${slot.startTime}</td>
      <td><input type="time" id="cut-${slot.id}" value="${slot.cutoffTime}"></td>
      <td id="timer-${slot.id}"></td>
      <td id="status-${slot.id}"></td>
      <td>
        <button onclick="saveCutoff('${slot.id}')">Save cut-off</button>
        <button onclick="deleteMeal('${slot.id}')">Delete</button>
      </td>
    </tr>
  `).join("");

  document.getElementById("mealRows").innerHTML =
    rows || "<tr><td colspan='8'>No meals yet.</td></tr>";
  updateTimers();
}

function makeDate(date, time) {
  return new Date(`${date}T${time}`);
}

function getStatus(slot) {
  const now = new Date();
  const cutoff = makeDate(slot.date, slot.cutoffTime);
  const end = new Date(makeDate(slot.date, slot.startTime).getTime() + 2 * 60 * 60 * 1000);

  if (now < cutoff) return "open";
  if (now < end) return "locked";
  return "closed";
}

function timeLeft(slot) {
  const secondsLeft = Math.floor((makeDate(slot.date, slot.cutoffTime) - new Date()) / 1000);
  if (secondsLeft <= 0) return "-";

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  return `${days > 0 ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`;
}

function updateTimers() {
  load("messos_slots").forEach(slot => {
    const timer = document.getElementById(`timer-${slot.id}`);
    const statusCell = document.getElementById(`status-${slot.id}`);
    if (!timer) return;

    const status = getStatus(slot);
    timer.textContent = timeLeft(slot);
    statusCell.innerHTML = `<span class="badge ${status}">${status}</span>`;
  });
}

function saveCutoff(id) {
  const slots = load("messos_slots");
  const slot = slots.find(item => item.id === id);
  const cutoff = document.getElementById(`cut-${id}`).value;

  if (!cutoff || cutoff >= slot.startTime) {
    alert("Cut-off must be earlier than the serving start time.");
    return;
  }

  slot.cutoffTime = cutoff;
  save("messos_slots", slots);
  refresh();
}

function showUsers() {
  const search = document.getElementById("search").value.toLowerCase();
  const users = load("messos_users").filter(user =>
    user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search)
  );
  const rows = users.map(user => `
    <tr>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.regNo}</td>
      <td>${user.role}</td>
      <td><button onclick="removeUser('${user.id}')">Remove</button></td>
    </tr>
  `).join("");

  document.getElementById("userRows").innerHTML =
    rows || "<tr><td colspan='5'>No users found.</td></tr>";
}

document.getElementById("search").addEventListener("input", showUsers);

document.getElementById("mealForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const slots = load("messos_slots");
  const message = document.getElementById("mealMsg");
  const date = document.getElementById("mDate").value;
  const mealType = document.getElementById("mType").value;
  const start = document.getElementById("mStart").value;
  const cutoff = document.getElementById("mCutoff").value;

  if (cutoff >= start) {
    message.textContent = "Cut-off must be earlier than the serving start time.";
    return;
  }
  if (slots.some(slot => slot.date === date && slot.mealType === mealType)) {
    message.textContent = `${mealType} already exists for that date.`;
    return;
  }

  const meal = {
    id: Date.now().toString(),
    date,
    mealType,
    items: document.getElementById("mItems").value,
    startTime: start,
    cutoffTime: cutoff
  };
  slots.push(meal);
  save("messos_slots", slots);

  const optins = load("messos_optins");
  load("messos_users").filter(user => user.role === "student").forEach(user => {
    optins.push({ userId: user.id, slotId: meal.id, optedIn: true });
  });
  save("messos_optins", optins);
  message.textContent = "Meal added.";

  refresh();
  this.reset();
});

function deleteMeal(id) {
  save("messos_slots", load("messos_slots").filter(slot => slot.id !== id));
  refresh();
}

document.getElementById("userForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const email = document.getElementById("uEmail").value.trim().toLowerCase();
  const message = document.getElementById("userMsg");
  const users = load("messos_users");

  if (!email.endsWith("@mnnit.ac.in")) {
    message.textContent = "Only @mnnit.ac.in emails are allowed.";
    return;
  }
  if (users.some(user => user.email === email)) {
    message.textContent = "That email is already registered.";
    return;
  }

  const user = {
    id: Date.now().toString(),
    name: document.getElementById("uName").value.trim(),
    email,
    regNo: document.getElementById("uReg").value.trim() || "-",
    role: document.getElementById("uRole").value
  };
  users.push(user);
  save("messos_users", users);

  if (user.role === "student") {
    const optins = load("messos_optins");
    load("messos_slots").forEach(slot => {
      optins.push({ userId: user.id, slotId: slot.id, optedIn: true });
    });
    save("messos_optins", optins);
  }

  message.textContent = "User added.";
  this.reset();
  refresh();
});

function removeUser(id) {
  if (!confirm("Remove this user?")) return;

  save("messos_users", load("messos_users").filter(user => user.id !== id));
  save("messos_optins", load("messos_optins").filter(optin => optin.userId !== id));
  refresh();
}

function refresh() {
  showSummary();
  showMeals();
  showUsers();
}

document.getElementById("mDate").value = today();
refresh();
setInterval(updateTimers, 1000);
