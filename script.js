import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFQ7vN8OzqQYxSb4PVBS0RqHz1qKS4UMg",
    authDomain: "cloudsync-developer-vault.firebaseapp.com",
    projectId: "cloudsync-developer-vault",
    storageBucket: "cloudsync-developer-vault.firebasestorage.app",
    messagingSenderId: "415429696355",
    appId: "1:415429696355:web:985b2611c86973da25d156"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("🔥 Firebase initialized:", app.name);

let currentUser = null;
let entries = [];
let activeCategory = "All";
let editingEntryId = null;
let authMode = "login";

const accountLabel = document.getElementById("accountLabel");
const accountSubtext = document.getElementById("accountSubtext");
const accountDot = document.getElementById("accountDot");
const guestActions = document.getElementById("guestActions");
const userActions = document.getElementById("userActions");
const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const logoutButton = document.getElementById("logoutButton");
const newEntryButton = document.getElementById("newEntryButton");
const entriesContainer = document.getElementById("entriesContainer");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const closeModalButton = document.getElementById("closeModalButton");
const cancelButton = document.getElementById("cancelButton");
const entryForm = document.getElementById("entryForm");
const titleInput = document.getElementById("titleInput");
const categoryInput = document.getElementById("categoryInput");
const contentInput = document.getElementById("contentInput");
const authModalOverlay = document.getElementById("authModalOverlay");
const authModalTitle = document.getElementById("authModalTitle");
const closeAuthModalButton = document.getElementById("closeAuthModalButton");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");
const switchAuthModeButton = document.getElementById("switchAuthModeButton");
const authSubmitButton = document.getElementById("authSubmitButton");
const toast = document.getElementById("toast");

function formatDate(timestamp) {
    if (!timestamp) {
        return "Unknown date";
    }

    const date = timestamp?.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }

    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function escapeHTML(value) {
    const div = document.createElement("div");

    div.textContent = String(value ?? "");

    return div.innerHTML;
}

function getTagClass(category) {
    return String(category || "Coding")
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function updateAccountUI() {
    if (currentUser) {
        accountLabel.textContent = currentUser.email || "Account";
        accountSubtext.textContent = "Signed in";

        accountDot.classList.add("logged-in");

        guestActions.hidden = true;
        userActions.hidden = false;

        newEntryButton.textContent = "+ New Vault Entry";
        newEntryButton.classList.remove("guest");
    } else {
        accountLabel.textContent = "Guest Mode";
        accountSubtext.textContent = "Not signed in";

        accountDot.classList.remove("logged-in");

        guestActions.hidden = false;
        userActions.hidden = true;

        newEntryButton.textContent = "🔒 Sign In to Create";
        newEntryButton.classList.add("guest");
    }
}

function getEntriesCollection() {
    if (!currentUser) {
        throw new Error("No authenticated user.");
    }

    return collection(
        db,
        "users",
        currentUser.uid,
        "entries"
    );
}

async function loadEntries() {
    if (!currentUser) {
        entries = [];
        renderEntries();
        return;
    }

    try {
        const snapshot = await getDocs(
            getEntriesCollection()
        );

        entries = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));

        entries.sort((a, b) => {
            const dateA = new Date(
                a.updatedAt ||
                a.createdAt ||
                0
            ).getTime();

            const dateB = new Date(
                b.updatedAt ||
                b.createdAt ||
                0
            ).getTime();

            return dateB - dateA;
        });

        renderEntries();
    } catch (error) {
        console.error(
            "Failed to load entries:",
            error
        );

        showToast(
            "Could not load your cloud entries."
        );
    }
}

function renderEntries() {
    const searchTerm = searchInput.value
        .trim()
        .toLowerCase();

    const selectedCategory = categoryFilter.value;

    const filteredEntries = entries.filter(entry => {
        const matchesCategory =
            (
                activeCategory === "All" ||
                entry.category === activeCategory
            ) &&
            (
                selectedCategory === "All" ||
                entry.category === selectedCategory
            );

        const title = String(
            entry.title || ""
        ).toLowerCase();

        const content = String(
            entry.content || ""
        ).toLowerCase();

        const matchesSearch =
            !searchTerm ||
            title.includes(searchTerm) ||
            content.includes(searchTerm);

        return matchesCategory && matchesSearch;
    });

    entriesContainer.innerHTML = "";

    if (filteredEntries.length === 0) {
        entriesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⌘</div>

                <h3>
                    ${
                        currentUser
                            ? "No entries found"
                            : "Guest Mode"
                    }
                </h3>

                <p>
                    ${
                        currentUser
                            ? "Your vault is currently empty here."
                            : "Browse CloudSync freely. Sign in to create your own vault entries."
                    }
                </p>
            </div>
        `;

        updateCounts();
        return;
    }

    filteredEntries.forEach(entry => {
        const card = document.createElement("article");

        card.className = "card";

        const categoryClass = getTagClass(
            entry.category || "Coding"
        );

        const actionButtons = currentUser
            ? `
                <div class="card-actions">

                    <button
                        class="card-action edit-action"
                        data-id="${entry.id}"
                        title="Edit entry"
                    >
                        ✎
                    </button>

                    <button
                        class="card-action delete-action"
                        data-id="${entry.id}"
                        title="Delete entry"
                    >
                        ×
                    </button>

                </div>
            `
            : "";

        card.innerHTML = `
            <div class="card-header">

                <div>

                    <span class="card-tag ${categoryClass}">
                        ${escapeHTML(
                            entry.category || "Coding"
                        )}
                    </span>

                    <h3 class="card-title">
                        ${escapeHTML(
                            entry.title || "Untitled"
                        )}
                    </h3>

                </div>

                ${actionButtons}

            </div>

            <div class="card-content">
                ${escapeHTML(
                    entry.content || ""
                )}
            </div>

            <div class="card-footer">

                <span>
                    ${formatDate(
                        entry.updatedAt ||
                        entry.createdAt
                    )}
                </span>

            </div>
        `;

        entriesContainer.appendChild(card);
    });

    document
        .querySelectorAll(".edit-action")
        .forEach(button => {
            button.addEventListener("click", () => {
                if (!currentUser) {
                    return;
                }

                openEditModal(
                    button.dataset.id
                );
            });
        });

    document
        .querySelectorAll(".delete-action")
        .forEach(button => {
            button.addEventListener("click", () => {
                if (!currentUser) {
                    return;
                }

                deleteEntry(
                    button.dataset.id
                );
            });
        });

    updateCounts();
}

function updateCounts() {
    const counts = {
        All: entries.length,
        Coding: 0,
        School: 0,
        Ideas: 0,
        Personal: 0
    };

    entries.forEach(entry => {
        if (
            Object.prototype.hasOwnProperty.call(
                counts,
                entry.category
            )
        ) {
            counts[entry.category]++;
        }
    });

    document.getElementById("allCount").textContent =
        counts.All;

    document.getElementById("codingCount").textContent =
        counts.Coding;

    document.getElementById("schoolCount").textContent =
        counts.School;

    document.getElementById("ideasCount").textContent =
        counts.Ideas;

    document.getElementById("personalCount").textContent =
        counts.Personal;
}

function openModal() {
    if (!currentUser) {
        openAuthModal("login");

        showToast(
            "Sign in to create vault entries."
        );

        return;
    }

    editingEntryId = null;

    modalTitle.textContent = "New Vault Entry";

    entryForm.reset();

    categoryInput.value = "Coding";

    modalOverlay.classList.add("show");

    setTimeout(
        () => titleInput.focus(),
        50
    );
}

function openEditModal(id) {
    if (!currentUser) {
        return;
    }

    const entry = entries.find(
        item => item.id === id
    );

    if (!entry) {
        return;
    }

    editingEntryId = id;

    modalTitle.textContent =
        "Edit Vault Entry";

    titleInput.value =
        entry.title || "";

    categoryInput.value =
        entry.category || "Coding";

    contentInput.value =
        entry.content || "";

    modalOverlay.classList.add("show");

    setTimeout(
        () => titleInput.focus(),
        50
    );
}

function closeModal() {
    modalOverlay.classList.remove("show");

    editingEntryId = null;

    entryForm.reset();
}

async function createEntry(
    title,
    category,
    content
) {
    if (!currentUser) {
        throw new Error(
            "Authentication required."
        );
    }

    const now =
        new Date().toISOString();

    const entryData = {
        title,
        category,
        content,
        createdAt: now,
        updatedAt: now
    };

    const documentReference =
        await addDoc(
            getEntriesCollection(),
            entryData
        );

    entries.unshift({
        id: documentReference.id,
        ...entryData
    });

    renderEntries();

    showToast(
        "Entry saved to the cloud."
    );
}

async function updateEntry(
    id,
    title,
    category,
    content
) {
    if (!currentUser) {
        throw new Error(
            "Authentication required."
        );
    }

    const now =
        new Date().toISOString();

    const entryReference =
        doc(
            db,
            "users",
            currentUser.uid,
            "entries",
            id
        );

    await updateDoc(
        entryReference,
        {
            title,
            category,
            content,
            updatedAt: now
        }
    );

    const entryIndex =
        entries.findIndex(
            entry => entry.id === id
        );

    if (entryIndex !== -1) {
        entries[entryIndex] = {
            ...entries[entryIndex],
            title,
            category,
            content,
            updatedAt: now
        };
    }

    entries.sort((a, b) => {
        return new Date(
            b.updatedAt || 0
        ) - new Date(
            a.updatedAt || 0
        );
    });

    renderEntries();

    showToast(
        "Entry updated."
    );
}

async function deleteEntry(id) {
    if (!currentUser) {
        return;
    }

    const entry = entries.find(
        item => item.id === id
    );

    if (!entry) {
        return;
    }

    const confirmed = confirm(
        `Delete "${entry.title}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) {
        return;
    }

    try {
        const entryReference =
            doc(
                db,
                "users",
                currentUser.uid,
                "entries",
                id
            );

        await deleteDoc(
            entryReference
        );

        entries = entries.filter(
            item => item.id !== id
        );

        renderEntries();

        showToast(
            "Entry deleted."
        );
    } catch (error) {
        console.error(
            "Failed to delete entry:",
            error
        );

        showToast(
            "Could not delete the entry."
        );
    }
}

function openAuthModal(mode) {
    authMode = mode;

    authMessage.textContent = "";
    authEmail.value = "";
    authPassword.value = "";

    if (authMode === "login") {
        authModalTitle.textContent =
            "Log In";

        authSubmitButton.textContent =
            "Log In";

        switchAuthModeButton.textContent =
            "Create Account";
    } else {
        authModalTitle.textContent =
            "Create Account";

        authSubmitButton.textContent =
            "Create Account";

        switchAuthModeButton.textContent =
            "Back to Log In";
    }

    authModalOverlay.classList.add("show");

    setTimeout(
        () => authEmail.focus(),
        50
    );
}

function closeAuthModal() {
    authModalOverlay.classList.remove("show");

    authForm.reset();

    authMessage.textContent = "";
}

function showAuthMessage(message) {
    authMessage.textContent = message;
}

loginButton.addEventListener(
    "click",
    () => {
        openAuthModal("login");
    }
);

signupButton.addEventListener(
    "click",
    () => {
        openAuthModal("signup");
    }
);

switchAuthModeButton.addEventListener(
    "click",
    () => {
        if (authMode === "login") {
            openAuthModal("signup");
        } else {
            openAuthModal("login");
        }
    }
);

authForm.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        showAuthMessage("");

        const email =
            authEmail.value.trim();

        const password =
            authPassword.value;

        authSubmitButton.disabled = true;
        switchAuthModeButton.disabled = true;

        authSubmitButton.textContent =
            authMode === "login"
                ? "Logging in..."
                : "Creating account...";

        try {
            if (authMode === "login") {
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

                showToast(
                    "Signed in successfully."
                );
            } else {
                if (password.length < 6) {
                    showAuthMessage(
                        "Password must be at least 6 characters."
                    );

                    return;
                }

                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

                showToast(
                    "Account created successfully."
                );
            }

            closeAuthModal();
        } catch (error) {
            console.error(
                "Authentication error:",
                error
            );

            switch (error.code) {
                case "auth/invalid-credential":
                    showAuthMessage(
                        "Incorrect email or password."
                    );
                    break;

                case "auth/user-not-found":
                    showAuthMessage(
                        "No account was found with that email."
                    );
                    break;

                case "auth/wrong-password":
                    showAuthMessage(
                        "Incorrect password."
                    );
                    break;

                case "auth/email-already-in-use":
                    showAuthMessage(
                        "An account already exists with that email."
                    );
                    break;

                case "auth/invalid-email":
                    showAuthMessage(
                        "Please enter a valid email address."
                    );
                    break;

                case "auth/weak-password":
                    showAuthMessage(
                        "That password is too weak."
                    );
                    break;

                case "auth/too-many-requests":
                    showAuthMessage(
                        "Too many attempts. Try again later."
                    );
                    break;

                default:
                    showAuthMessage(
                        error.message
                    );
            }
        } finally {
            authSubmitButton.disabled = false;
            switchAuthModeButton.disabled = false;

            authSubmitButton.textContent =
                authMode === "login"
                    ? "Log In"
                    : "Create Account";
        }
    }
);

logoutButton.addEventListener(
    "click",
    async () => {
        try {
            await signOut(auth);

            showToast(
                "Logged out."
            );
        } catch (error) {
            console.error(
                "Logout error:",
                error
            );

            showToast(
                "Could not log out."
            );
        }
    }
);

newEntryButton.addEventListener(
    "click",
    openModal
);

closeModalButton.addEventListener(
    "click",
    closeModal
);

cancelButton.addEventListener(
    "click",
    closeModal
);

modalOverlay.addEventListener(
    "click",
    event => {
        if (event.target === modalOverlay) {
            closeModal();
        }
    }
);

closeAuthModalButton.addEventListener(
    "click",
    closeAuthModal
);

authModalOverlay.addEventListener(
    "click",
    event => {
        if (
            event.target ===
            authModalOverlay
        ) {
            closeAuthModal();
        }
    }
);

entryForm.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        if (!currentUser) {
            closeModal();

            openAuthModal("login");

            showToast(
                "Sign in to save entries."
            );

            return;
        }

        const title =
            titleInput.value.trim();

        const category =
            categoryInput.value;

        const content =
            contentInput.value.trim();

        if (
            !title ||
            !category ||
            !content
        ) {
            showToast(
                "Please fill in every field."
            );

            return;
        }

        const saveButton =
            entryForm.querySelector(
                ".save-button"
            );

        saveButton.disabled = true;

        saveButton.textContent =
            editingEntryId
                ? "Updating..."
                : "Saving...";

        try {
            if (editingEntryId) {
                await updateEntry(
                    editingEntryId,
                    title,
                    category,
                    content
                );
            } else {
                await createEntry(
                    title,
                    category,
                    content
                );
            }

            closeModal();
        } catch (error) {
            console.error(
                "Failed to save entry:",
                error
            );

            showToast(
                "Could not save the entry."
            );
        } finally {
            saveButton.disabled = false;
            saveButton.textContent =
                "Save Entry";
        }
    }
);

searchInput.addEventListener(
    "input",
    renderEntries
);

categoryFilter.addEventListener(
    "change",
    () => {
        activeCategory =
            categoryFilter.value;

        document
            .querySelectorAll(
                ".sidebar-item"
            )
            .forEach(item => {
                item.classList.toggle(
                    "active",
                    item.dataset.category ===
                    activeCategory
                );
            });

        renderEntries();
    }
);

document
    .querySelectorAll(".sidebar-item")
    .forEach(button => {
        button.addEventListener(
            "click",
            () => {
                activeCategory =
                    button.dataset.category;

                categoryFilter.value =
                    activeCategory;

                document
                    .querySelectorAll(
                        ".sidebar-item"
                    )
                    .forEach(item => {
                        item.classList.remove(
                            "active"
                        );
                    });

                button.classList.add("active");

                renderEntries();
            }
        );
    });

document.addEventListener(
    "keydown",
    event => {
        if (event.key !== "Escape") {
            return;
        }

        if (
            modalOverlay.classList.contains(
                "show"
            )
        ) {
            closeModal();
        } else if (
            authModalOverlay.classList.contains(
                "show"
            )
        ) {
            closeAuthModal();
        }
    }
);

onAuthStateChanged(
    auth,
    async user => {
        currentUser = user;

        updateAccountUI();

        if (user) {
            console.log(
                "🔐 Auth state: Logged in",
                user.email
            );

            await loadEntries();
        } else {
            console.log(
                "🔐 Auth state: Guest Mode"
            );

            entries = [];
            activeCategory = "All";

            categoryFilter.value = "All";

            document
                .querySelectorAll(
                    ".sidebar-item"
                )
                .forEach(item => {
                    item.classList.toggle(
                        "active",
                        item.dataset.category ===
                        "All"
                    );
                });

            renderEntries();
        }
    }
);