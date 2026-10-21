// ==========================================
// WALK-IN ASSISTANT (chat bot logic)
// ==========================================
//
// How it works: the assistant reads a message, picks out the subject, class, area,
// budget and a few other hints, and searches the tutor list with them.
//
// It is rule-based, NOT a language model. That is why it is free, needs no API key
// and works without extra services. It only uses the public tutor data
// (never phone numbers or emails).

(function (root) {

    var MAX_MESSAGE_LENGTH = 300;
    var MAX_RESULTS = 3;

    var DEFAULT_CHIPS = [
        "Maths tutor for class 8",
        "Cheapest English tutor",
        "Best rated tutors",
        "How does a demo work?"
    ];

    // Subjects the assistant knows even when no tutor teaches them yet
    var KNOWN_SUBJECTS = [
        "maths", "science", "physics", "chemistry", "biology", "english", "hindi",
        "social science", "computer science", "sanskrit", "history", "geography",
        "economics", "accountancy", "evs"
    ];

    // Different spellings of the same subject
    var ALIASES = {
        "math": "maths",
        "mathematics": "maths",
        "sst": "social science",
        "social studies": "social science",
        "bio": "biology",
        "chem": "chemistry",
        "computer": "computer science",
        "computers": "computer science",
        "cs": "computer science"
    };

    // Words that can follow "in" or "at" but are not places
    var NOT_AREAS = [
        "class", "grade", "standard", "online", "home", "general", "school", "college",
        "evening", "morning", "weekend", "weekends", "time", "fees", "price", "rating",
        "order", "case", "future", "mind", "person", "particular", "budget", "this",
        "that", "these", "those", "some", "any", "good", "best", "cheap"
    ];


    // ---------- small helpers ----------

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // Is this whole word / phrase inside the text?
    function hasWord(text, phrase) {
        return new RegExp("(^|[^a-z0-9])" + escapeRegExp(phrase) + "([^a-z0-9]|$)").test(text);
    }

    function clean(message) {
        return String(message || "")
            .slice(0, MAX_MESSAGE_LENGTH)
            .toLowerCase()
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/\s+/g, " ")
            .trim();
    }

    function titleCase(text) {
        return String(text).replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
    }

    function canonicalSubject(subject) {
        var s = String(subject).toLowerCase().trim();
        return ALIASES[s] || s;
    }

    function tutorSubjects(tutor) {
        return String(tutor.subjects || "")
            .split(",")
            .map(canonicalSubject)
            .filter(Boolean);
    }

    function unique(list) {
        return list.filter(function (item, index) { return list.indexOf(item) === index; });
    }

    // Distance in km between two points
    function distanceKm(lat1, lng1, lat2, lng2) {

        var toRad = function (d) { return d * Math.PI / 180; };
        var dLat = toRad(lat2 - lat1);
        var dLng = toRad(lng2 - lng1);

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }


    // ---------- understanding the message ----------

    function extractSubjects(text, tutors) {

        // Every phrase we can recognise, and the subject it stands for
        var phrases = {};

        KNOWN_SUBJECTS.forEach(function (s) { phrases[s] = s; });
        Object.keys(ALIASES).forEach(function (a) { phrases[a] = ALIASES[a]; });

        // Subjects that real tutors have typed
        tutors.forEach(function (t) {
            tutorSubjects(t).forEach(function (s) { phrases[s] = s; });
        });

        // Longest first, so "social science" is found before "science"
        var keys = Object.keys(phrases).sort(function (a, b) { return b.length - a.length; });

        var work = text;
        var found = [];

        keys.forEach(function (key) {

            if (!hasWord(work, key)) {
                return;
            }

            if (found.indexOf(phrases[key]) === -1) {
                found.push(phrases[key]);
            }

            // Remove it, so a shorter phrase inside it is not found again
            work = work.replace(
                new RegExp("(^|[^a-z0-9])" + escapeRegExp(key) + "(?=[^a-z0-9]|$)", "g"),
                "$1 "
            );

        });

        return found;
    }

    // "class 8", "8th", "grade 10", "9th class"
    function extractClass(text) {

        var m = text.match(/\b(?:class|grade|std|standard)\s*(?:no\.?\s*)?(\d{1,2})\b/) ||
                text.match(/\b(\d{1,2})\s*(?:st|nd|rd|th)\b/) ||
                text.match(/\b(\d{1,2})\s*(?:class|grade)\b/);

        return m ? Number(m[1]) : null;
    }

    function toNumber(raw, kilo) {
        var n = parseFloat(String(raw).replace(/,/g, ""));
        return kilo ? n * 1000 : n;
    }

    // "under 1500", "below Rs 2000", "budget 1.5k", "1500 se kam", "₹1200"
    function extractBudget(text) {

        var patterns = [
            /(?:under|below|less than|lesser than|upto|up to|within|max|maximum|budget|at most|not more than|around|about|<=?)\s*(?:of\s*)?(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/,
            /(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/,
            /(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:rupees|rupaye|rs|inr)\b/,
            /(\d[\d,]*)\s*()(?:se kam|tak|ke andar|se neeche)/
        ];

        for (var i = 0; i < patterns.length; i++) {

            var m = text.match(patterns[i]);

            if (m) {
                var n = toNumber(m[1], m[2]);

                // Monthly fees are never this small or this big
                if (n >= 200 && n <= 100000) {
                    return n;
                }
            }
        }

        return null;
    }

    function extractMode(text) {

        if (hasWord(text, "online")) {
            return "online";
        }

        if (/\btutor'?s home\b|\byour home\b/.test(text)) {
            return "tutor-home";
        }

        if (/\b(?:my|student'?s|our) home\b|\bat home\b|\bhome tuition\b|\bhome tutor\b/.test(text)) {
            return "student-home";
        }

        return null;
    }

    // Every kind of ordering the message asks for (it can ask for more than one)
    function sortHints(text) {

        var kinds = [];

        if (/\b(nearest|closest|nearby|near me|close to me|around me|paas|nazdeek)\b/.test(text)) {
            kinds.push("nearest");
        }

        if (/\b(cheap|cheapest|affordable|lowest (?:fee|fees|price)|low (?:fee|fees|price)|sasta|saste)\b/.test(text)) {
            kinds.push("cheapest");
        }

        if (/\b(best|top|top rated|best rated|highest rated|highest rating|highly rated)\b/.test(text)) {
            kinds.push("best");
        }

        return kinds;
    }

    // We can only sort by one thing, so the first one wins
    function extractSort(text) {
        return sortHints(text)[0] || null;
    }

    // Parts of the tutors' area names, e.g. "Civil Lines, Kannauj" -> "civil lines", "kannauj"
    function extractAreas(text, tutors) {

        var parts = {};

        tutors.forEach(function (t) {
            String(t.area || "").toLowerCase().split(/[,\/]/).forEach(function (p) {
                p = p.trim();
                if (p.length >= 3) {
                    parts[p] = true;
                }
            });
        });

        return Object.keys(parts)
            .sort(function (a, b) { return b.length - a.length; })
            .filter(function (p) { return hasWord(text, p); });
    }

    // A place the user mentioned that no tutor has, e.g. "in Lucknow"
    function extractUnknownArea(text, subjects) {

        var m = text.match(/\b(?:in|at|near|around|from)\s+([a-z][a-z'-]{3,})(?:\s+([a-z][a-z'-]{3,}))?(?=\s*(?:$|[,.?!]|\s(?:for|under|below|with|who|and|class|grade|tutor|tutors|teacher|please|within|upto|budget|online)\b))/);

        if (!m) {
            return null;
        }

        var first = m[1];

        if (NOT_AREAS.indexOf(first) !== -1) {
            return null;
        }

        // The word is a subject, not a place
        var asSubject = ALIASES[first] || first;

        if (subjects.indexOf(asSubject) !== -1 || KNOWN_SUBJECTS.indexOf(asSubject) !== -1) {
            return null;
        }

        var name = first;

        if (m[2] && NOT_AREAS.indexOf(m[2]) === -1 && KNOWN_SUBJECTS.indexOf(ALIASES[m[2]] || m[2]) === -1) {
            name = first + " " + m[2];
        }

        return titleCase(name);
    }


    // ---------- filters ----------

    function emptyFilters() {
        return { subjects: [], cls: null, maxFee: null, areas: [], mode: null, sort: null };
    }

    // New hints replace the old ones of the same kind, the rest stay (follow-up questions)
    function mergeFilters(previous, found) {

        var result = {
            subjects: previous.subjects.slice(),
            cls: previous.cls,
            maxFee: previous.maxFee,
            areas: previous.areas.slice(),
            mode: previous.mode,
            sort: previous.sort
        };

        if (found.subjects.length) { result.subjects = found.subjects; }
        if (found.cls !== null) { result.cls = found.cls; }
        if (found.maxFee !== null) { result.maxFee = found.maxFee; }
        if (found.areas.length) { result.areas = found.areas; }
        if (found.mode) { result.mode = found.mode; }
        if (found.sort) { result.sort = found.sort; }

        return result;
    }

    function describeFilters(f) {

        var parts = [];

        if (f.subjects.length) { parts.push(f.subjects.map(titleCase).join(" + ")); }
        if (f.cls !== null) { parts.push("Class " + f.cls); }
        if (f.maxFee !== null) { parts.push("under ₹" + f.maxFee); }
        if (f.areas.length) { parts.push("in " + f.areas.map(titleCase).join(" / ")); }
        if (f.mode === "online") { parts.push("Online"); }
        if (f.mode === "student-home") { parts.push("At student's home"); }
        if (f.mode === "tutor-home") { parts.push("At tutor's home"); }
        var order = f.sort === "cheapest" ? "cheapest first"
                  : f.sort === "best" ? "best rated first"
                  : f.sort === "nearest" ? "nearest first" : "";

        return { what: parts.join(" · "), order: order };
    }

    function tutorMatches(t, f) {

        if (f.subjects.length) {
            var mine = tutorSubjects(t);
            if (!f.subjects.some(function (s) { return mine.indexOf(s) !== -1; })) { return false; }
        }

        if (f.cls !== null && String(t.classes || "").split(" ").indexOf(String(f.cls)) === -1) {
            return false;
        }

        if (f.maxFee !== null && !(t.fees <= f.maxFee)) {
            return false;
        }

        if (f.areas.length) {
            var area = String(t.area || "").toLowerCase();
            if (!f.areas.some(function (p) { return hasWord(area, p); })) { return false; }
        }

        if (f.mode) {
            var mode = String(t.mode || "").toLowerCase();
            var ok = f.mode === "online" ? mode.indexOf("online") !== -1
                   : f.mode === "student-home" ? mode.indexOf("student") !== -1
                   : mode.indexOf("tutor") !== -1;
            if (!ok) { return false; }
        }

        return true;
    }

    // Best matches first. Works on copies, the page's tutor data is never changed.
    function rankTutors(list, f, userLocation) {

        var rows = list.map(function (t) {

            var mine = tutorSubjects(t);

            return {
                tutor: t,
                subjectScore: f.subjects.filter(function (s) { return mine.indexOf(s) !== -1; }).length,
                rating: t.reviews > 0 ? t.rating : 0,
                reviews: t.reviews || 0,
                fees: t.fees,
                km: (userLocation && typeof t.lat === "number")
                    ? distanceKm(userLocation.lat, userLocation.lng, t.lat, t.lng)
                    : null
            };
        });

        rows.sort(function (a, b) {

            if (f.sort === "nearest" && userLocation) {
                var ak = a.km === null ? 99999 : a.km;
                var bk = b.km === null ? 99999 : b.km;
                if (ak !== bk) { return ak - bk; }
            }

            if (b.subjectScore !== a.subjectScore) { return b.subjectScore - a.subjectScore; }

            if (f.sort === "cheapest" && a.fees !== b.fees) { return a.fees - b.fees; }

            if (b.rating !== a.rating) { return b.rating - a.rating; }
            if (b.reviews !== a.reviews) { return b.reviews - a.reviews; }

            return a.fees - b.fees;
        });

        return rows.map(function (row) {
            return Object.assign({}, row.tutor, { distanceKm: row.km });
        });
    }


    // ---------- building answers ----------

    function answer(text, extra) {

        var result = { text: text, results: [], more: 0, chips: [], actions: [], listFilter: null };

        Object.keys(extra || {}).forEach(function (key) { result[key] = extra[key]; });

        return result;
    }

    var FAQ = {

        demo: "A demo class lets you try a tutor before you decide.\n" +
              "1) Log in with a Student / Parent account (or create one).\n" +
              "2) Click Demo on a tutor's card and choose your approximate area on the map.\n" +
              "3) The tutor sees your request and contacts you on the phone number you gave.\n" +
              "4) After the demo the tutor marks it as completed, and you can rate them from My Demos.",

        tutor: "To teach on Walk-In Tutor: create an account and choose Tutor, then click " +
               "Become a Tutor and fill in your subjects, classes, fees and approximate location. " +
               "Students will find you in the search and send demo requests, which you can see under My Requests.",

        rating: "After a demo, the tutor marks it as completed and you can give 1 to 5 stars and a short review " +
                "from My Demos. Only students who really had a demo can rate. The average shows on the tutor's card, " +
                "and clicking it lists the reviews.",

        privacy: "Your exact location is never stored. Locations are rounded to an area of about 1 km before they are sent. " +
                 "A tutor only sees your approximate area and the phone number you enter in the demo request. " +
                 "Phone numbers and emails never appear in the public tutor list.",

        payment: "Walk-In Tutor does not handle payments. The fee on a profile is the monthly fee the tutor expects. " +
                 "You agree the details directly with the tutor after the demo.",

        verified: "The ✓ Verified badge marks profiles that have been checked by the platform. " +
                  "New profiles appear without it until they are checked. Taking a demo first is the best way to judge a tutor.",

        account: "Click Login, then Create an account. Choose Student / Parent if you are looking for a tutor, " +
                 "or Tutor if you want to teach. You can change your name and password later from Account."
    };

    function helpText() {
        return "I can search tutors by subject, class, area and budget, and answer questions about demos, " +
               "ratings, privacy and becoming a tutor. Try:\n" +
               "• Maths tutor for class 8 under ₹1500\n" +
               "• Cheapest English tutor in Kannauj\n" +
               "• Best rated tutors\n" +
               "• How does a demo work?";
    }

    function feeSummary(tutors) {

        var fees = tutors.map(function (t) { return t.fees; }).filter(function (n) { return typeof n === "number"; });

        if (fees.length === 0) {
            return "";
        }

        var min = Math.min.apply(null, fees);
        var max = Math.max.apply(null, fees);
        var avg = Math.round(fees.reduce(function (a, b) { return a + b; }, 0) / fees.length);

        return "Monthly fees range from ₹" + min + " to ₹" + max + " (average about ₹" + avg + ").";
    }

    // The search itself
    function findTutors(found, ctx, feeIntent, unknownArea) {

        var tutors = ctx.tutors;
        var state = ctx.state;
        var notes = [];

        // The site has tutors for classes 5 to 12
        if (found.cls !== null && (found.cls < 5 || found.cls > 12)) {
            notes.push("We currently have tutors for classes 5 to 12.");
            found.cls = null;
        }

        var filters = mergeFilters(state.filters, found);
        state.filters = filters;

        if (unknownArea) {
            notes.push("I don't have any tutor in " + unknownArea + " yet, so I ignored the place.");
        }

        var actions = [];

        if (filters.sort === "nearest" && !ctx.userLocation) {
            notes.push("To sort by distance I need your location, tap the button below.");
            actions.push("locate");
        }

        var described = describeFilters(filters);
        var summary = described.what;
        var orderLabel = described.order;

        // The message asked for two kinds of ordering, but we can use only one
        if (found.sortHintCount > 1) {
            var used = filters.sort === "nearest" ? "distance" : filters.sort === "cheapest" ? "price" : "rating";
            notes.push("I can sort by only one thing at a time, so I sorted by " + used + ".");
        }

        var followUps = ["Under ₹1500", "Nearest first", "Reset filters"];

        if (tutors.length === 0) {
            return answer("The tutor list is empty or still loading. Please try again in a moment.");
        }

        var matching = tutors.filter(function (t) { return tutorMatches(t, filters); });
        var headline;

        if (matching.length === 0) {

            // Try dropping one filter at a time to find the closest options
            var relaxable = [
                { key: "maxFee", label: "budget limit", value: null },
                { key: "areas", label: "area", value: [] },
                { key: "mode", label: "teaching mode", value: null },
                { key: "cls", label: "class", value: null }
            ];

            for (var i = 0; i < relaxable.length; i++) {

                var item = relaxable[i];
                var isSet = Array.isArray(filters[item.key]) ? filters[item.key].length > 0 : filters[item.key] !== null;

                if (!isSet) { continue; }

                var relaxed = Object.assign({}, filters);
                relaxed[item.key] = item.value;

                var alternatives = tutors.filter(function (t) { return tutorMatches(t, relaxed); });

                if (alternatives.length > 0) {
                    matching = alternatives;
                    headline = "No tutor matches all of that (" + (summary || "your request") + "). Without the " + item.label + ", I found:";
                    break;
                }
            }

            if (matching.length === 0) {
                return answer(
                    notes.concat(["I couldn't find a tutor for " + (summary || "that") + ". New tutors join often, " +
                        "so check again later, or try another subject or class."]).join("\n"),
                    { chips: ["Reset filters", "Best rated tutors"] }
                );
            }

        } else {
            headline = "I found " + matching.length + (matching.length === 1 ? " tutor" : " tutors") +
                (summary ? (/^in /.test(summary) ? " " : " for ") + summary : "") +
                (orderLabel ? ", " + orderLabel : "") +
                (matching.length > MAX_RESULTS ? ". Here are the top " + MAX_RESULTS + ":" : ":");
        }

        var ranked = rankTutors(matching, filters, ctx.userLocation);
        var lines = notes.concat([headline]);

        if (feeIntent) {
            var summaryLine = feeSummary(matching);
            if (summaryLine) { lines.push(summaryLine); }
        }

        // "Show in the tutor list" button: the page search box takes one word and one class
        var listSearch = filters.subjects.length ? titleCase(filters.subjects[0])
                       : filters.areas.length ? titleCase(filters.areas[0]) : "";

        actions.push("showInList");

        return answer(lines.join("\n"), {
            results: ranked.slice(0, MAX_RESULTS),
            more: Math.max(0, ranked.length - MAX_RESULTS),
            chips: followUps,
            actions: actions,
            listFilter: { search: listSearch, cls: filters.cls }
        });
    }


    // ---------- the main function ----------

    function reply(message, ctx) {

        var text = clean(message);
        var tutors = ctx.tutors || [];

        ctx = { tutors: tutors, userLocation: ctx.userLocation || null, state: ctx.state };

        if (!text) {
            return answer("Please type a message.", { chips: DEFAULT_CHIPS });
        }

        // Small talk
        if (/\b(thanks|thank you|thx|shukriya|dhanyavad)\b/.test(text)) {
            return answer("You're welcome! Ask me anything else about tutors.");
        }

        if (/^(hi+|hello+|hey+|namaste|good (morning|afternoon|evening))( there| bot| walk-in)?[ !.]*$/.test(text)) {
            return answer("Hi! 👋 I can find tutors by subject, class, area and budget. " +
                "For example: Maths tutor for class 8 under ₹1500.", { chips: DEFAULT_CHIPS });
        }

        if (/\b(reset|start over|clear filters|new search|forget)\b/.test(text)) {
            ctx.state.filters = emptyFilters();
            return answer("Done, I cleared the filters. What are you looking for?", { chips: DEFAULT_CHIPS });
        }

        if (/\b(help|what can you do|how do you work)\b/.test(text)) {
            return answer(helpText(), { chips: DEFAULT_CHIPS });
        }

        // What did the user ask for?
        var subjects = extractSubjects(text, tutors);

        var found = {
            subjects: subjects,
            cls: extractClass(text),
            maxFee: extractBudget(text),
            areas: extractAreas(text, tutors),
            mode: extractMode(text),
            sort: extractSort(text),
            sortHintCount: sortHints(text).length
        };

        // Clear questions about the platform come first, even if they mention a subject
        if (/\b(want to teach|wanna teach|like to teach|start teaching|teach on|become (a )?tutor|register as (a )?tutor|join as (a )?tutor|apply as (a )?tutor)\b/.test(text)) {
            return answer(FAQ.tutor, { chips: ["How does a demo work?"] });
        }

        if (/\bhow\b.*\bdemo\b|\bwhat is (a )?demo\b|\bdemo (class )?(works?|process)\b/.test(text)) {
            return answer(FAQ.demo, { chips: ["How are ratings given?", "Is my location safe?"] });
        }

        var hasHint = found.subjects.length > 0 || found.cls !== null || found.maxFee !== null ||
                      found.areas.length > 0 || found.mode !== null || found.sort !== null;

        var feeIntent = /\b(fee|fees|price|prices|cost|costs|charge|charges|how much)\b/.test(text);

        // A place that no tutor has
        var unknownArea = found.areas.length === 0 ? extractUnknownArea(text, subjects) : null;

        if (hasHint) {
            return findTutors(found, ctx, feeIntent, unknownArea);
        }

        // Questions about the platform (only when the message is not a search)
        if (/(become|register|join|sign ?up).*\b(tutor|teacher)\b|\b(teach|teaching)\b|tutor profile/.test(text)) {
            return answer(FAQ.tutor, { chips: ["How does a demo work?"] });
        }

        if (/\b(demo|trial)\b/.test(text)) {
            return answer(FAQ.demo, { chips: ["How are ratings given?", "Is my location safe?"] });
        }

        if (/\b(rating|ratings|review|reviews|stars?)\b/.test(text)) {
            return answer(FAQ.rating);
        }

        if (/\b(privacy|private|safe|safety|secure|security|exact location|address|stored)\b/.test(text)) {
            return answer(FAQ.privacy);
        }

        if (/\b(pay|payment|payments|paid|money|refund|invoice)\b/.test(text)) {
            return answer(FAQ.payment);
        }

        if (/\b(verified|verification|trusted|trust|genuine|fake)\b/.test(text)) {
            return answer(FAQ.verified);
        }

        if (/\b(login|log in|sign ?up|account|password|register)\b/.test(text)) {
            return answer(FAQ.account);
        }

        // Fee question without any filter
        if (feeIntent) {
            var summaryLine = feeSummary(tutors);
            return answer((summaryLine || "Fees depend on the tutor.") +
                " Fees depend on the subject, class and tutor. Tell me a subject and class for a closer estimate.",
                { chips: DEFAULT_CHIPS });
        }

        // "Show me tutors", "I need a teacher"
        if (/\b(tutor|tutors|teacher|teachers)\b/.test(text) &&
            /\b(show|list|find|recommend|suggest|search|need|want|looking|get|any)\b/.test(text)) {
            return findTutors(found, ctx, false, null);
        }

        return answer("I'm not sure I understood that. I can search tutors by subject, class, area and budget, " +
            "or answer questions about demos, ratings, privacy and becoming a tutor.", { chips: DEFAULT_CHIPS });
    }

    function createState() {
        return { filters: emptyFilters() };
    }

    var api = {
        reply: reply,
        createState: createState,
        suggestions: DEFAULT_CHIPS,
        // exposed so they can be tested one by one
        _parts: {
            extractSubjects: extractSubjects,
            extractClass: extractClass,
            extractBudget: extractBudget,
            extractMode: extractMode,
            extractSort: extractSort,
            extractAreas: extractAreas,
            extractUnknownArea: extractUnknownArea
        }
    };

    root.WalkInBot = api;

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }

})(typeof window !== "undefined" ? window : globalThis);