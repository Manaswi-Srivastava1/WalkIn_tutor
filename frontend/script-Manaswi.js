// ==========================================
// WALK-IN TUTOR JAVASCRIPT
// ==========================================


// ==========================================
// SCROLL TO FIND TUTOR
// ==========================================

function scrollToFind() {

    document
        .getElementById("find")
        .scrollIntoView({
            behavior: "smooth"
        });

}


// ==========================================
// TEACHER REGISTRATION MODAL
// ==========================================

function openTeacherForm() {

    // Tutor profile ke liye login zaroori hai
    if (!currentUser) {

        alert("You need a Tutor account to create a tutor profile. Please log in, or create a new Tutor account.");

        preferredRole = "tutor";

        openLogin();

        return;

    }

    // Student / Parent account tutor profile nahi bana sakta
    if (currentUser.role !== "tutor") {

        alert("You are logged in with a Student / Parent account. A tutor profile can only be created with a Tutor account. " +
              "Please log out and create a Tutor account.");

        return;

    }

    // Account ki details pehle se bhar do
    const nameInput = document.getElementById("teacherName");

    if (nameInput.value === "") {
        nameInput.value = currentUser.name;
    }

    const emailInput = document.getElementById("teacherEmail");
    emailInput.value = currentUser.email;
    emailInput.readOnly = true;

    document
        .getElementById("teacherModal")
        .style.display = "flex";

    // Modal dikhne ke baad hi map banao
    tutorPicker.init();

}


function closeTeacherForm() {

    document
        .getElementById("teacherModal")
        .style.display = "none";

}


// ==========================================
// TEACHER FORM (SERVER KO BHEJO)
// ==========================================

document
    .getElementById("teacherForm")
    .addEventListener("submit", async function(event) {

        event.preventDefault();

        const form = this;

        // Location chuni gayi hai?
        if (tutorPicker.getLat() === null || tutorPicker.getLng() === null) {

            alert("📍 Please choose your location on the map, either with the Use my location button or by clicking on the map.");

            return;

        }

        // Form ka saara data ek jagah jama karo
        const data = {
            lat: tutorPicker.getLat(),
            lng: tutorPicker.getLng(),
            name: document.getElementById("teacherName").value,
            email: document.getElementById("teacherEmail").value,
            phone: document.getElementById("phone").value,
            college: document.getElementById("college").value,
            course: document.getElementById("course").value,
            subjects: document.getElementById("subjects").value,
            teachingClass: document.getElementById("teachingClass").value,
            area: document.getElementById("area").value,
            fees: document.getElementById("fees").value,
            mode: document.getElementById("mode").value
        };

        try {

            // Server ko bhejo
            const response = await fetch("/api/tutors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            // Server ne error di (jaise profile pehle se hai)
            if (response.status === 401) {
                alert("❌ " + result.error);
                closeTeacherForm();
                handleLoggedOut();
                return;
            }

            if (!response.ok) {
                alert("❌ " + result.error);
                return;
            }

            tutorPicker.clear();

            alert("🎉 Tutor Profile Created!\n\nYour profile will now appear in the tutor list.");

            form.reset();
            closeTeacherForm();

            // List dobara mangwao, taaki naya tutor dikhe
            loadTutors();

        } catch (error) {

            alert("⚠️ Could not connect to the server. Please check that the server is running.");

        }

    });


// ==========================================
// LOGIN
// ==========================================

function openLogin() {

    document
        .getElementById("loginModal")
        .style.display = "flex";

}


function closeLogin() {

    document
        .getElementById("loginModal")
        .style.display = "none";

}


// ------------------------------------------
// ACCOUNT: kaun login hai?
// ------------------------------------------

let currentUser = null;

// Kis type ka account banane ke liye signup khola ja raha hai ("tutor" ya "student")
let preferredRole = null;

// Navbar mein Login / naam + Logout dikhao
function updateNav() {

    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const userName = document.getElementById("userName");
    const requestsBtn = document.getElementById("requestsBtn");

    requestsBtn.style.display = (currentUser && currentUser.role === "tutor") ? "inline-block" : "none";

    if (currentUser) {

        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        userName.style.display = "inline";
        userName.innerText = "Hi, " + currentUser.name.split(" ")[0] +
            (currentUser.role === "tutor" ? " (Tutor)" : "");

    } else {

        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userName.style.display = "none";
        userName.innerText = "";

    }

}

// Server se poocho ki abhi koi login hai ya nahi
async function loadUser() {

    try {

        const response = await fetch("/api/me");
        const result = await response.json();

        currentUser = result.user;

    } catch (error) {

        currentUser = null;

    }

    updateNav();

}

// Session khatam ho gaya ho to
function handleLoggedOut() {

    currentUser = null;
    updateNav();
    openLogin();

}

// ------------------------------------------
// SIGNUP
// ------------------------------------------

function openSignup() {

    document.getElementById("signupModal").style.display = "flex";

}

function closeSignup() {

    document.getElementById("signupModal").style.display = "none";

}

function switchToSignup(event) {

    event.preventDefault();
    closeLogin();
    openSignup();

    // "Become a Tutor" ya "Demo" se aaye ho to account type pehle se chun do
    if (preferredRole) {
        document.getElementById("signupRole").value = preferredRole;
        preferredRole = null;
    }

}

function switchToLogin(event) {

    event.preventDefault();
    closeSignup();
    openLogin();

}

document
    .getElementById("signupForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();

        const form = this;

        const data = {
            name: document.getElementById("signupName").value,
            email: document.getElementById("signupEmail").value,
            password: document.getElementById("signupPassword").value,
            role: document.getElementById("signupRole").value
        };

        try {

            const response = await fetch("/api/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                alert("❌ " + result.error);
                return;
            }

            currentUser = result.user;
            updateNav();

            alert(currentUser.role === "tutor"
                ? "🎉 Tutor account created! Now click 'Become a Tutor' to set up your profile."
                : "🎉 Account created! Welcome, " + currentUser.name + ".");

            form.reset();
            closeSignup();

        } catch (error) {

            alert("⚠️ Could not connect to the server. Please check that the server is running.");

        }

    });

// ------------------------------------------
// LOGIN
// ------------------------------------------

document
    .getElementById("loginForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();

        const form = this;

        const data = {
            email: document.getElementById("loginEmail").value,
            password: document.getElementById("loginPassword").value
        };

        try {

            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                alert("❌ " + result.error);
                return;
            }

            currentUser = result.user;
            updateNav();

            alert("✅ Login successful!");

            form.reset();
            closeLogin();

        } catch (error) {

            alert("⚠️ Could not connect to the server. Please check that the server is running.");

        }

    });

// ------------------------------------------
// LOGOUT
// ------------------------------------------

async function logout() {

    try {

        await fetch("/api/logout", { method: "POST" });

    } catch (error) {

        console.log("Logout error:", error);

    }

    currentUser = null;
    updateNav();

    alert("👋 You have been logged out.");

}


// ==========================================
// TUTORS (DATABASE SE)
// ==========================================

// Saare tutors yahan rakhenge
let allTutors = [];

// Special characters ko safe banata hai (security ke liye)
function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
}

// Server se tutors mangwao
async function loadTutors() {
    try {
        const response = await fetch("/api/tutors");
        allTutors = await response.json();
        searchTutors();
    } catch (error) {
        console.log("Could not load tutors:", error);
    }
}

// Tutors ke cards screen par banao
function showTutors(tutors) {
    const grid = document.getElementById("tutorGrid");
    grid.innerHTML = "";

    tutors.forEach(function (t) {
        const card = document.createElement("div");
        card.className = "tutor-card";

        // Agar visitor ne "Show distance from me" dabaya hai
        let distanceLine = "";

        if (userLocation && typeof t.lat === "number") {

            const km = distanceKm(userLocation.lat, userLocation.lng, t.lat, t.lng);

            distanceLine = "<p>🧭 ≈ " + (km < 1 ? "less than 1" : km.toFixed(1)) + " km away</p>";

        }

        card.innerHTML = `
            <div class="avatar">🧑🏻‍🏫</div>
            <div class="tutor-content">
                ${t.verified ? '<span class="verified">✓ Verified</span>' : ''}
                <h3>${escapeHtml(t.name)}</h3>
                <p>🎓 ${escapeHtml(t.qualification || "")}</p>
                <p>📚 ${escapeHtml(t.subjects)}</p>
                <p>📍 ${escapeHtml(t.area)}</p>
                ${distanceLine}
                <div class="rating">
                    ${t.reviews > 0
                        ? "⭐ " + t.rating + " <small>(" + t.reviews + " reviews)</small>"
                        : "🆕 New tutor"}
                </div>
                <div class="card-bottom">
                    <strong>₹${t.fees}/month</strong>
                    <button>Demo</button>
                </div>
            </div>
        `;

        card.querySelector("button").addEventListener("click", function () {
            requestDemo(t.id, t.name);
        });

        grid.appendChild(card);
    });

    document.getElementById("noResult").style.display =
        tutors.length === 0 ? "block" : "none";

    // Map par bhi wahi tutors dikhao
    updateTutorMap(tutors);
}

// Search aur class filter
function searchTutors() {
    const searchText = document
        .getElementById("searchInput")
        .value.toLowerCase()
        .trim();

    const selectedClass = document.getElementById("classFilter").value;

    const results = allTutors.filter(function (t) {
        const searchable = (t.name + " " + t.subjects + " " + t.area).toLowerCase();

        const matchesSearch = searchText === "" || searchable.includes(searchText);

        const matchesClass =
            selectedClass === "" ||
            (t.classes || "").split(" ").includes(selectedClass);

        return matchesSearch && matchesClass;
    });

    // Agar visitor ki location pata hai, to sabse paas wale pehle
    if (userLocation) {

        results.sort(function (a, b) {
            return tutorDistance(a) - tutorDistance(b);
        });

    }

    showTutors(results);
}


// ==========================================
// MAP (LEAFLET + OPENSTREETMAP)
// ==========================================

let tutorMap = null;
let tutorLayer = null;

// Visitor ki location (sirf browser mein rehti hai, server ko nahi bheji jaati)
let userLocation = null;

function mapAvailable() {
    return typeof L !== "undefined";
}

// Location ko 2 decimal tak round karo = lagbhag 1 km ka grid, exact jagah nahi
function approxCoord(value) {
    return Math.round(value * 100) / 100;
}

// Do jagah ke beech ki doori (km mein)
function distanceKm(lat1, lng1, lat2, lng2) {

    const toRad = function (d) { return d * Math.PI / 180; };
    const R = 6371;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

}

// Sorting ke liye: tutor ki doori (location na ho to sabse peeche)
function tutorDistance(t) {

    if (!userLocation || typeof t.lat !== "number") {
        return 99999;
    }

    return distanceKm(userLocation.lat, userLocation.lng, t.lat, t.lng);

}

function addTiles(map) {

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

}

// ---------- Main map (sab tutors) ----------

function initTutorMap() {

    if (!mapAvailable()) {

        document.getElementById("tutorMap").innerHTML =
            '<p class="map-error">The map could not be loaded. Please check your internet connection.</p>';

        return;

    }

    tutorMap = L.map("tutorMap").setView([22.5, 79], 5);

    addTiles(tutorMap);

    tutorLayer = L.layerGroup().addTo(tutorMap);

}

function updateTutorMap(tutors) {

    if (!tutorMap) {
        return;
    }

    tutorLayer.clearLayers();

    const points = [];

    tutors.forEach(function (t) {

        // Jis tutor ki location nahi hai, usse map par nahi dikhate
        if (typeof t.lat !== "number" || typeof t.lng !== "number") {
            return;
        }

        // 1 km ka circle: "is area ke andar kahin"
        L.circle([t.lat, t.lng], {
            radius: 1000,
            color: "#ffb800",
            fillColor: "#ffb800",
            fillOpacity: 0.25,
            weight: 2
        }).addTo(tutorLayer);

        // Chhota dot, taaki zoom out karne par bhi dikhe
        const dot = L.circleMarker([t.lat, t.lng], {
            radius: 7,
            color: "#000",
            weight: 2,
            fillColor: "#ffb800",
            fillOpacity: 1
        }).addTo(tutorLayer);

        dot.bindPopup(
            "<strong>" + escapeHtml(t.name) + "</strong><br>" +
            "📚 " + escapeHtml(t.subjects) + "<br>" +
            "₹" + t.fees + "/month<br>" +
            "<small>Approx. area (within ~1 km)</small>"
        );

        points.push([t.lat, t.lng]);

    });

    // Visitor ki apni location (sirf usse dikhti hai)
    if (userLocation) {

        L.circleMarker([userLocation.lat, userLocation.lng], {
            radius: 8,
            color: "#fff",
            weight: 2,
            fillColor: "#0b5fff",
            fillOpacity: 1
        }).addTo(tutorLayer).bindPopup("You are here");

        points.push([userLocation.lat, userLocation.lng]);

    }

    if (points.length > 0) {
        tutorMap.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
    }

}

// "Show distance from me" button
function showNearMe() {

    if (!navigator.geolocation) {
        alert("Your browser does not support location access.");
        return;
    }

    navigator.geolocation.getCurrentPosition(

        function (position) {

            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            document.getElementById("nearMeNote").innerText =
                "Distances are approximate (tutor locations are within ~1 km). " +
                "Your location stays in your browser and is not sent to the server.";

            searchTutors();

        },

        function () {
            alert("Location access was denied. Please allow location permission in your browser and try again.");
        }

    );

}

// ---------- Location chunne wala map (tutor form aur demo form, dono ke liye) ----------

function createLocationPicker(mapId, statusId) {

    let map = null;
    let circle = null;
    let lat = null;
    let lng = null;

    const defaultNote = document.getElementById(statusId).textContent.trim();

    const picker = {

        init: function () {

            if (!mapAvailable()) {

                document.getElementById(mapId).innerHTML =
                    '<p class="map-error">The map could not be loaded. Please check your internet connection.</p>';

                return;

            }

            if (!map) {

                map = L.map(mapId).setView([22.5, 79], 4);

                addTiles(map);

                map.on("click", function (event) {
                    picker.set(event.latlng.lat, event.latlng.lng, false);
                });

            }

            // Modal abhi khula hai, isliye map ka size dobara napna padta hai
            setTimeout(function () {
                map.invalidateSize();
            }, 200);

        },

        set: function (latitude, longitude, zoomIn) {

            // Round yahin, browser mein: exact location network par jaati hi nahi
            lat = approxCoord(latitude);
            lng = approxCoord(longitude);

            if (map) {

                if (circle) {
                    map.removeLayer(circle);
                }

                circle = L.circle([lat, lng], {
                    radius: 1000,
                    color: "#ffb800",
                    fillColor: "#ffb800",
                    fillOpacity: 0.3,
                    weight: 2
                }).addTo(map);

                if (zoomIn) {
                    map.setView([lat, lng], 13);
                }

            }

            document.getElementById(statusId).textContent =
                "✅ Location selected. Only this ~1 km area will be shared, not your exact spot.";

        },

        useMyLocation: function () {

            if (!navigator.geolocation) {
                alert("Your browser does not support location access. Please click on the map to choose your location.");
                return;
            }

            navigator.geolocation.getCurrentPosition(

                function (position) {
                    picker.set(position.coords.latitude, position.coords.longitude, true);
                },

                function () {
                    alert("Location access was denied. Please click on the map to choose your area.");
                }

            );

        },

        clear: function () {

            lat = null;
            lng = null;

            if (map && circle) {
                map.removeLayer(circle);
                circle = null;
            }

            document.getElementById(statusId).textContent = defaultNote;

        },

        getLat: function () { return lat; },
        getLng: function () { return lng; }

    };

    return picker;

}

// Do alag pickers: ek tutor form ke liye, ek demo form ke liye
const tutorPicker = createLocationPicker("pickerMap", "pickerStatus");
const demoPicker = createLocationPicker("demoPickerMap", "demoPickerStatus");

function useMyLocation() {
    tutorPicker.useMyLocation();
}

function useMyLocationForDemo() {
    demoPicker.useMyLocation();
}


// ==========================================
// DEMO REQUEST
// ==========================================

// Kis tutor ke liye request ho rahi hai
let currentDemoTutorId = null;

// Demo wala form kholo
function requestDemo(id, name) {

    // Demo request ke liye login zaroori hai
    if (!currentUser) {

        alert("You need a Student / Parent account to request a demo. Please log in, or create a new account.");

        preferredRole = "student";

        openLogin();

        return;

    }

    // Tutor account demo request nahi bhej sakta
    if (currentUser.role !== "student") {

        alert("Tutor accounts cannot request demos. Please log in with a Student / Parent account.");

        return;

    }

    currentDemoTutorId = id;

    const nameInput = document.getElementById("demoStudentName");

    if (nameInput.value === "") {
        nameInput.value = currentUser.name;
    }

    document.getElementById("demoTutorName").innerText =
        "Demo class with " + name;

    document.getElementById("demoModal").style.display = "flex";

    // Modal dikhne ke baad hi map banao
    demoPicker.init();

}

function closeDemoForm() {

    document.getElementById("demoModal").style.display = "none";

}

// Form submit hone par server ko bhejo
document
    .getElementById("demoForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();

        const form = this;

        // Student ki location chuni gayi hai?
        if (demoPicker.getLat() === null || demoPicker.getLng() === null) {

            alert("📍 Please choose your location on the map, either with the Use my location button or by clicking on the map.");

            return;

        }

        const data = {
            lat: demoPicker.getLat(),
            lng: demoPicker.getLng(),
            tutorId: currentDemoTutorId,
            studentName: document.getElementById("demoStudentName").value,
            phone: document.getElementById("demoPhone").value,
            studentClass: document.getElementById("demoClass").value,
            message: document.getElementById("demoMessage").value
        };

        try {

            const response = await fetch("/api/demo-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.status === 401) {
                alert("❌ " + result.error);
                closeDemoForm();
                handleLoggedOut();
                return;
            }

            if (!response.ok) {
                alert("❌ " + result.error);
                return;
            }

            demoPicker.clear();

            alert("✅ Demo Request Sent!\n\nThe tutor will contact you soon.");

            form.reset();
            closeDemoForm();

        } catch (error) {

            alert("⚠️ Could not connect to the server. Please check that the server is running.");

        }

    });


// ==========================================
// TUTOR: MUJHE MILI DEMO REQUESTS
// ==========================================

let requestsMap = null;
let requestsLayer = null;

function closeRequests() {

    document.getElementById("requestsModal").style.display = "none";

}

// Ek request ka card banao (DOM se, taaki koi bhi text script ki tarah na chale)
function buildRequestCard(r, tutorLocation) {

    const card = document.createElement("div");
    card.className = "request-card";

    const title = document.createElement("h4");
    title.textContent = r.studentName + " (Class " + r.studentClass + ")";
    card.appendChild(title);

    // Phone: click karte hi call
    const phoneLine = document.createElement("p");
    const phoneLink = document.createElement("a");
    phoneLink.href = "tel:" + String(r.phone).replace(/[^0-9+]/g, "");
    phoneLink.textContent = "📞 " + r.phone;
    phoneLine.appendChild(phoneLink);
    card.appendChild(phoneLine);

    if (r.message) {
        const messageLine = document.createElement("p");
        messageLine.textContent = "💬 " + r.message;
        card.appendChild(messageLine);
    }

    // Student kitni door hai (dono location lagbhag hain, isliye "≈")
    const placeLine = document.createElement("p");

    if (typeof r.lat === "number" && typeof r.lng === "number") {

        if (tutorLocation) {

            const km = distanceKm(tutorLocation.lat, tutorLocation.lng, r.lat, r.lng);

            placeLine.textContent = "🧭 ≈ " + (km < 1 ? "less than 1" : km.toFixed(1)) + " km from your area";

        } else {

            placeLine.textContent = "🧭 Student's approximate area is shown on the map";

        }

    } else {

        placeLine.textContent = "🧭 Location not shared";

    }

    card.appendChild(placeLine);

    const time = document.createElement("small");
    time.textContent = new Date(r.createdAt).toLocaleString();
    card.appendChild(time);

    return card;

}

function drawRequestsMap(requests, tutorLocation) {

    if (!mapAvailable()) {
        return;
    }

    const points = [];

    requests.forEach(function (r) {
        if (typeof r.lat === "number" && typeof r.lng === "number") {
            points.push([r.lat, r.lng]);
        }
    });

    if (points.length === 0) {
        return;
    }

    if (tutorLocation) {
        points.push([tutorLocation.lat, tutorLocation.lng]);
    }

    document.getElementById("requestsMap").style.display = "block";

    if (!requestsMap) {

        requestsMap = L.map("requestsMap").setView([22.5, 79], 5);

        addTiles(requestsMap);

        requestsLayer = L.layerGroup().addTo(requestsMap);

    }

    requestsLayer.clearLayers();

    // Students: neele circle (1 km area)
    requests.forEach(function (r) {

        if (typeof r.lat !== "number" || typeof r.lng !== "number") {
            return;
        }

        L.circle([r.lat, r.lng], {
            radius: 1000,
            color: "#0b5fff",
            fillColor: "#0b5fff",
            fillOpacity: 0.2,
            weight: 2
        }).addTo(requestsLayer);

        const popup = document.createElement("div");
        popup.textContent = r.studentName + " (Class " + r.studentClass + ")";

        L.circleMarker([r.lat, r.lng], {
            radius: 7,
            color: "#fff",
            weight: 2,
            fillColor: "#0b5fff",
            fillOpacity: 1
        }).addTo(requestsLayer).bindPopup(popup);

    });

    // Tutor ka apna area: peela circle
    if (tutorLocation) {

        L.circle([tutorLocation.lat, tutorLocation.lng], {
            radius: 1000,
            color: "#ffb800",
            fillColor: "#ffb800",
            fillOpacity: 0.3,
            weight: 2
        }).addTo(requestsLayer);

        L.circleMarker([tutorLocation.lat, tutorLocation.lng], {
            radius: 7,
            color: "#000",
            weight: 2,
            fillColor: "#ffb800",
            fillOpacity: 1
        }).addTo(requestsLayer).bindPopup("Your area");

    }

    // Modal abhi khula hai, isliye size dobara napo, phir sab points dikhao
    setTimeout(function () {

        requestsMap.invalidateSize();

        requestsMap.fitBounds(points, { padding: [30, 30], maxZoom: 13 });

    }, 200);

}

async function openRequests() {

    if (!currentUser) {
        openLogin();
        return;
    }

    const intro = document.getElementById("requestsIntro");
    const list = document.getElementById("requestsList");

    document.getElementById("requestsModal").style.display = "flex";
    document.getElementById("requestsMap").style.display = "none";

    list.innerHTML = "";
    intro.textContent = "Loading...";

    try {

        const response = await fetch("/api/my-requests");
        const result = await response.json();

        if (response.status === 401) {
            closeRequests();
            handleLoggedOut();
            return;
        }

        if (!response.ok) {
            intro.textContent = result.error;
            return;
        }

        if (!result.hasProfile) {
            intro.textContent = "Create your tutor profile first. Demo requests for your profile will appear here.";
            return;
        }

        if (result.requests.length === 0) {
            intro.textContent = "No demo requests yet.";
            return;
        }

        intro.textContent = result.requests.length +
            " request(s). Student locations are approximate (about 1 km).";

        result.requests.forEach(function (r) {
            list.appendChild(buildRequestCard(r, result.tutorLocation));
        });

        drawRequestsMap(result.requests, result.tutorLocation);

    } catch (error) {

        intro.textContent = "Could not connect to the server. Please check that it is running.";

    }

}


// ==========================================
// AI CHAT
// ==========================================

function openAI() {

    document
        .getElementById("chatBox")
        .style.display = "block";

}


function closeAI() {

    document
        .getElementById("chatBox")
        .style.display = "none";

}


// ==========================================
// SEND AI MESSAGE
// ==========================================

function sendMessage() {


    let input =

        document
        .getElementById("chatInput");


    let message =

        input
        .value
        .trim();


    if (message === "") {

        return;

    }


    let messages =

        document
        .getElementById("chatMessages");


    // USER MESSAGE

    let userMessage =

        document
        .createElement("div");


    userMessage.className =
        "user-message";


    userMessage.innerText =
        message;


    messages.appendChild(
        userMessage
    );


    input.value = "";


    // BOT RESPONSE

    setTimeout(function() {


        let botMessage =

            document
            .createElement("div");


        botMessage.className =
            "bot-message";


        let text =
            message.toLowerCase();


        // MATHS

        if (

            text.includes("math") ||

            text.includes("mathematics")

        ) {

            botMessage.innerText =

                "📚 I can help you find Maths tutors. " +

                "Try searching 'Maths' in the tutor search section.";

        }


        // ENGLISH

        else if (

            text.includes("english")

        ) {

            botMessage.innerText =

                "📖 We have English tutors available. " +

                "Search 'English' to see matching tutors.";

        }


        // SCIENCE

        else if (

            text.includes("science") ||

            text.includes("physics")

        ) {

            botMessage.innerText =

                "🔬 You can find Science and Physics tutors " +

                "using the search box.";

        }


        // FEES

        else if (

            text.includes("fee") ||

            text.includes("fees") ||

            text.includes("price") ||

            text.includes("budget")

        ) {

            botMessage.innerText =

                "💰 Tutor fees depend on class, subject, " +

                "location and teaching hours. " +

                "Compare tutor profiles before requesting a demo.";

        }


        // NEARBY

        else if (

            text.includes("near") ||

            text.includes("nearby") ||

            text.includes("location")

        ) {

            botMessage.innerText =

                "📍 Enter your area in the search box " +

                "to find tutors near you.";

        }


        // DEMO

        else if (

            text.includes("demo")

        ) {

            botMessage.innerText =

                "🎓 Click the Demo button on any tutor profile " +

                "to request a demo class.";

        }


        // DEFAULT

        else {

            botMessage.innerText =

                "🤖 I can help you find tutors based on " +

                "subject, class, location and budget.";

        }


        messages.appendChild(
            botMessage
        );


        messages.scrollTop =
            messages.scrollHeight;


    }, 600);

}


// ==========================================
// ENTER KEY FOR AI CHAT
// ==========================================

document
    .getElementById("chatInput")
    .addEventListener("keypress", function(event) {

        if (event.key === "Enter") {

            sendMessage();

        }

    });


// ==========================================
// CLOSE MODALS WHEN CLICKING OUTSIDE
// ==========================================

window.addEventListener(
    "click",
    function(event) {


        let teacherModal =
            document.getElementById(
                "teacherModal"
            );


        let loginModal =
            document.getElementById(
                "loginModal"
            );


        if (event.target === teacherModal) {

            closeTeacherForm();

        }


        if (event.target === loginModal) {

            closeLogin();

        }

    }
);


// Demo aur Signup form ke bahar click karne par band karo
window.addEventListener("click", function (event) {

    if (event.target === document.getElementById("demoModal")) {

        closeDemoForm();

    }

    if (event.target === document.getElementById("signupModal")) {

        closeSignup();

    }

    if (event.target === document.getElementById("requestsModal")) {

        closeRequests();

    }

});


// Phone boxes mein sirf numbers (maximum 10) hi likhe ja sakein
["phone", "demoPhone"].forEach(function (id) {

    document.getElementById(id).addEventListener("input", function () {

        this.value = this.value.replace(/\D/g, "").slice(0, 10);

    });

});


// Page khulte hi tutors mangwao
initTutorMap();
loadTutors();
loadUser();