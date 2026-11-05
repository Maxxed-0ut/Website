import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase.js";

const opportunities = [
  { title: "Add keyboard shortcuts to Radix UI", source: "Open source", sourceLabel: "Good first issue", details: "Radix UI · 2 days ago", skills: ["React", "TypeScript"], match: "94%", mark: "GH", logo: "logo-gh" },
  { title: "Cal Hacks 12.0 — Build for impact", source: "Hackathon", sourceLabel: "In person · Berkeley", details: "Oct 18–20 · 12 days left", skills: ["Open to all"], match: "89%", mark: "✳", logo: "logo-hack" },
  { title: "Build a dashboard for community data", source: "Bounty", sourceLabel: "$250 bounty", details: "Civic Labs · Remote", skills: ["Next.js", "Design"], match: "86%", mark: "$", logo: "logo-bounty" },
  { title: "Make maps more accessible", source: "Open source", sourceLabel: "Good first issue", details: "OpenStreetMap · 4 days ago", skills: ["JavaScript", "UI"], match: "82%", mark: "↗", logo: "logo-event" }
];

const list = document.getElementById("opportunityList");
const toast = document.getElementById("toast");
const savedOpportunities = new Set();
const questList = document.getElementById("questList");
const authDialog = document.getElementById("authDialog");
const authForm = document.getElementById("authForm");
const authError = document.getElementById("authError");
const authConfigNote = document.getElementById("authConfigNote");
const displayNameField = document.getElementById("displayNameField");
const displayNameInput = document.getElementById("displayNameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authActions = document.getElementById("authActions");
const signOutButton = document.getElementById("signOutButton");

let authUser = null;
let createAccountMode = false;
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function showBackendError(action, error) {
  console.error(`${action} failed`, error);
  showToast(`${action} failed. Please try again.`);
}

function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function opportunityId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderOpportunities(filter = "all") {
  const filtered = filter === "all" ? opportunities : opportunities.filter(item => item.source === filter);
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">Nothing here just yet. Check back soon.</div>';
    return;
  }
  list.innerHTML = filtered.map(item => {
    const saved = savedOpportunities.has(opportunityId(item.title));
    return `<article class="opportunity-item">
      <div class="opportunity-logo ${item.logo}">${item.mark}</div>
      <div class="opportunity-info">
        <strong title="${item.title}">${item.title}</strong>
        <div class="opportunity-meta"><span>${item.sourceLabel}</span><i></i><span>${item.details}</span>${item.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join("")}</div>
      </div>
      <div class="opportunity-action"><span class="match-label">${item.match} match</span><button class="save-button${saved ? " saved" : ""}" data-save="${opportunityId(item.title)}" aria-label="${saved ? "Unsave" : "Save"} ${item.title}" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button></div>
    </article>`;
  }).join("");
}

renderOpportunities();

document.querySelector(".opportunity-tabs").addEventListener("click", event => {
  const tab = event.target.closest("[data-filter]");
  if (!tab) return;
  document.querySelectorAll(".opportunity-tab").forEach(button => {
    const active = button === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  renderOpportunities(tab.dataset.filter);
});

list.addEventListener("click", async event => {
  const button = event.target.closest("[data-save]");
  if (!button) return;
  const id = button.dataset.save;
  const opportunity = opportunities.find(item => opportunityId(item.title) === id);
  if (!opportunity) return;

  if (!authUser) {
    showToast(firebaseConfigured ? "Sign in to sync saved opportunities." : "Configure Firebase to save opportunities.");
    return;
  }

  const saved = savedOpportunities.has(id);
  try {
    const savedRef = doc(db, "users", authUser.uid, "savedOpportunities", id);
    if (saved) {
      await deleteDoc(savedRef);
      savedOpportunities.delete(id);
      showToast("Removed from your saved opportunities.");
    } else {
      await setDoc(savedRef, { ...opportunity, savedAt: serverTimestamp() });
      savedOpportunities.add(id);
      showToast("Saved — you can find it in your opportunities.");
    }
    const activeTab = document.querySelector(".opportunity-tab.active");
    renderOpportunities(activeTab ? activeTab.dataset.filter : "all");
  } catch (error) {
    showBackendError("Saving opportunity", error);
  }
});

function updateQuests() {
  const quests = [...questList.querySelectorAll(".quest-item")];
  const complete = quests.filter(quest => quest.querySelector("input").checked).length;
  document.getElementById("questCount").textContent = `${complete} / ${quests.length}`;
  document.getElementById("questProgress").style.width = `${(complete / quests.length) * 100}%`;
  quests.forEach(quest => quest.classList.toggle("completed", quest.querySelector("input").checked));
}

questList.addEventListener("change", async event => {
  if (!event.target.matches("input[type=checkbox]")) return;
  const checkbox = event.target;
  updateQuests();
  const quest = checkbox.closest(".quest-item");
  const questId = quest.dataset.questId;
  if (authUser) {
    try {
      await setDoc(doc(db, "users", authUser.uid, "quests", `${todayKey()}_${questId}`), {
        date: todayKey(),
        questId,
        completed: checkbox.checked,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      updateQuests();
      showBackendError("Saving quest progress", error);
      return;
    }
  } else {
    checkbox.checked = !checkbox.checked;
    updateQuests();
    showToast(firebaseConfigured ? "Sign in to sync quest progress." : "Configure Firebase to save quest progress.");
    if (firebaseConfigured) openAuthDialog();
    return;
  }
  if (checkbox.checked) {
    const label = quest.querySelector("strong").textContent;
    showToast(label === "Make a little progress" ? "Nice work — commit quest complete! +40 XP" : "Peer review quest complete! +30 XP");
  } else {
    showToast("Quest progress updated.");
  }
});

function setQuestCompletion(completionById) {
  questList.querySelectorAll(".quest-item").forEach(quest => {
    const checkbox = quest.querySelector("input");
    checkbox.checked = Object.hasOwn(completionById, quest.dataset.questId)
      ? completionById[quest.dataset.questId]
      : quest.dataset.questId === "show-up";
  });
  updateQuests();
}

async function loadUserData(user) {
  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  const profile = {
    email: user.email ?? "",
    displayName: user.displayName || user.email?.split("@")[0] || "Builder",
    updatedAt: serverTimestamp()
  };
  if (!profileSnapshot.exists()) profile.createdAt = serverTimestamp();
  await setDoc(profileRef, profile, { merge: true });

  const questsQuery = query(
    collection(db, "users", user.uid, "quests"),
    where("date", "==", todayKey())
  );
  const [questSnapshot, savedSnapshot] = await Promise.all([
    getDocs(questsQuery),
    getDocs(collection(db, "users", user.uid, "savedOpportunities"))
  ]);
  const completionById = {};
  questSnapshot.forEach(snapshot => {
    const quest = snapshot.data();
    completionById[quest.questId] = quest.completed === true;
  });
  setQuestCompletion(completionById);
  savedOpportunities.clear();
  savedSnapshot.forEach(snapshot => savedOpportunities.add(snapshot.id));
  renderOpportunities(document.querySelector(".opportunity-tab.active")?.dataset.filter ?? "all");
}

function updateAccountUI(user) {
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Guest builder";
  const initials = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "GB";
  document.getElementById("userName").textContent = displayName;
  document.getElementById("userStatus").textContent = user ? user.email || "Builder" : "Sign in to sync progress";
  document.getElementById("userInitials").textContent = initials;
  document.getElementById("topProfileButton").textContent = initials;
  authActions.hidden = Boolean(user);
  signOutButton.hidden = !user;
  document.getElementById("resetPasswordButton").hidden = Boolean(user) || createAccountMode;
  document.getElementById("signInButton").textContent = createAccountMode ? "Create account" : "Sign in";
  document.getElementById("createAccountButton").textContent = createAccountMode ? "Back to sign in" : "Create account";
  emailInput.disabled = Boolean(user);
  passwordInput.disabled = Boolean(user);
  displayNameField.hidden = Boolean(user) || !createAccountMode;
  displayNameInput.required = !user && createAccountMode;
  document.getElementById("authTitle").textContent = user ? "Your Guild account" : "Welcome to Guild.";
}

function authErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "That email already has an account. Try signing in instead.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/operation-not-allowed": "Email/password sign-in is disabled in Firebase Authentication settings.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "auth/user-disabled": "This account has been disabled. Contact the project administrator.",
    "auth/user-not-found": "No account exists for that email. Create an account first.",
    "auth/weak-password": "Choose a password with at least 6 characters."
  };
  return messages[error.code] || "Authentication failed. Check your details and Firebase settings, then try again.";
}

function openAuthDialog() {
  authError.textContent = "";
  authConfigNote.hidden = firebaseConfigured;
  updateAccountUI(authUser);
  authDialog.showModal();
}

document.getElementById("profileButton").addEventListener("click", openAuthDialog);
document.getElementById("topProfileButton").addEventListener("click", openAuthDialog);
document.getElementById("closeAuthDialog").addEventListener("click", () => authDialog.close());

document.getElementById("createAccountButton").addEventListener("click", () => {
  if (!firebaseConfigured) {
    authError.textContent = "Add your Firebase environment variables before creating an account.";
    return;
  }
  createAccountMode = !createAccountMode;
  updateAccountUI(null);
  authError.textContent = "";
  if (createAccountMode) displayNameInput.focus();
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!firebaseConfigured) {
    authError.textContent = "Add your Firebase environment variables before signing in.";
    return;
  }
  try {
    if (createAccountMode) {
      const credential = await createUserWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
      await updateProfile(credential.user, { displayName: displayNameInput.value.trim() });
      updateAccountUI(credential.user);
      authDialog.close();
      showToast("Your account is ready.");
    } else {
      await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
    }
  } catch (error) {
    console.error(createAccountMode ? "Account creation failed" : "Sign-in failed", error);
    authError.textContent = authErrorMessage(error);
  }
});

document.getElementById("resetPasswordButton").addEventListener("click", async () => {
  if (!emailInput.value.trim()) {
    authError.textContent = "Enter your email address first, then choose “Forgot your password?” again.";
    emailInput.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, emailInput.value.trim());
    authError.textContent = "";
    showToast("If an account exists for that email, a reset link is on its way.");
  } catch (error) {
    console.error("Password reset request failed", error);
    authError.textContent = authErrorMessage(error);
  }
});

signOutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    authDialog.close();
    showToast("You have been signed out.");
  } catch (error) {
    console.error("Sign-out failed", error);
    authError.textContent = "Could not sign out. Please try again.";
  }
});

if (firebaseConfigured) {
  onAuthStateChanged(auth, async user => {
    authUser = user;
    updateAccountUI(user);
    if (!user) {
      savedOpportunities.clear();
      setQuestCompletion({});
      renderOpportunities();
      return;
    }
    try {
      await loadUserData(user);
      if (authDialog.open) authDialog.close();
      showToast("Your Guild progress is synced.");
    } catch (error) {
      showBackendError("Loading your Guild data", error);
    }
  });
} else {
  updateAccountUI(null);
}

document.getElementById("todayDate").textContent = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
updateQuests();

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view === "Discover") {
      document.querySelector('[data-filter="all"]').click();
      document.querySelector(".opportunity-card").scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Here's what's waiting for you.");
    } else if (view === "Overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`${view} is coming soon — this is a preview of your builder HQ.`);
    }
    document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === view));
    document.getElementById("sidebar").classList.remove("open");
  });
});

document.getElementById("newProjectButton").addEventListener("click", () => showToast("Project creation is coming soon — your next big thing starts here."));
document.getElementById("notificationButton").addEventListener("click", () => showToast("You're all caught up. Go make something!"));
document.querySelector(".tiny-add").addEventListener("click", () => showToast("Guild discovery is coming soon."));

document.getElementById("mobileMenu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});
document.addEventListener("click", event => {
  const sidebar = document.getElementById("sidebar");
  const menu = document.getElementById("mobileMenu");
  if (sidebar.classList.contains("open") && !sidebar.contains(event.target) && !menu.contains(event.target)) {
    sidebar.classList.remove("open");
  }
});

document.querySelector(".tree-visual").addEventListener("click", event => {
  const node = event.target.closest("[data-skill]");
  if (node) showToast(`${node.dataset.skill} · Skill details are coming soon.`);
});

document.querySelector(".activity-more").addEventListener("click", () => showToast("You're seeing the latest guild activity."));
