const datePicker = document.getElementById("date-picker");
const liturgicalDayEl = document.getElementById("liturgical-day");
const liturgicalNoteEl = document.getElementById("liturgical-note");
const fastingTypeEl = document.getElementById("fasting-type");
const fastingIconEl = document.getElementById("fasting-icon");
const fastingDescriptionEl = document.getElementById("fasting-description");
const fastingSourceEl = document.getElementById("fasting-source");
const readingsListEl = document.getElementById("readings-list");
const saintsListEl = document.getElementById("saints-list");

const today = new Date();

function pad(num) {
  return num.toString().padStart(2, "0");
}

function toKey(date) {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function setInitialDate() {
  const formattedToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
    today.getDate()
  )}`;
  datePicker.value = formattedToday;
  const initialKey = toKey(today);
  renderDay(initialKey);
}

function renderDay(key) {
  const dayData = ORTHODOX_CALENDAR[key];

  if (!dayData) {
    liturgicalDayEl.textContent = "Liturgical texts pending";
    liturgicalNoteEl.textContent = "Authentic sources are being prepared for this day.";
    liturgicalNoteEl.style.display = "block";
    fastingTypeEl.textContent = "Awaiting Data";
    fastingIconEl.textContent = "🕯️";
    fastingDescriptionEl.textContent =
      "The authentic fasting guidelines and scripture readings for this date will be added from official Russian Orthodox sources.";
    fastingSourceEl.textContent = "";
    readingsListEl.innerHTML = `
      <article class="reading-card">
        <p class="reading-text">
          Please consult the official liturgical calendar or the Orthodox Study Bible for today’s appointed readings.
        </p>
      </article>`;
    saintsListEl.innerHTML = `
      <article class="saint-card">
        <p class="saint-life">
          Saints’ lives, hymns, and prayers for this day will be curated from the Synaxarion and authorized liturgical books.
        </p>
      </article>`;
    return;
  }

  liturgicalDayEl.textContent = dayData.liturgicalDay;
  if (dayData.liturgicalNote) {
    liturgicalNoteEl.textContent = dayData.liturgicalNote;
    liturgicalNoteEl.style.display = "block";
  } else {
    liturgicalNoteEl.textContent = "";
    liturgicalNoteEl.style.display = "none";
  }

  fastingTypeEl.textContent = dayData.fast.type;
  const icon = dayData.fast.icon || FASTING_ICONS[dayData.fast.type] || "🕯️";
  fastingIconEl.textContent = icon;
  fastingDescriptionEl.textContent = dayData.fast.description;
  fastingSourceEl.textContent = dayData.fast.source ? `Source: ${dayData.fast.source}` : "";

  renderReadings(dayData.readings || []);
  renderSaints(dayData.saints || []);
}

function renderReadings(readings) {
  if (!readings.length) {
    readingsListEl.innerHTML = `
      <article class="reading-card">
        <p class="reading-text">
          Official readings for this day will be added soon from the Orthodox Study Bible lectionary.
        </p>
      </article>`;
    return;
  }

  readingsListEl.innerHTML = "";

  readings.forEach((reading) => {
    const card = document.createElement("article");
    card.className = "reading-card";

    const meta = document.createElement("div");
    meta.className = "reading-meta";
    meta.innerHTML = `<span>${reading.title}</span><span>${reading.citation}</span>`;

    const textContainer = document.createElement("div");
    textContainer.className = "reading-text";

    (reading.text || []).forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      textContainer.appendChild(p);
    });

    card.appendChild(meta);
    card.appendChild(textContainer);

    if (reading.commentary) {
      const commentary = document.createElement("blockquote");
      commentary.className = "commentary";
      commentary.textContent = reading.commentary.quote;

      if (reading.commentary.source) {
        const cite = document.createElement("cite");
        cite.textContent = reading.commentary.source;
        commentary.appendChild(cite);
      }

      card.appendChild(commentary);
    }

    readingsListEl.appendChild(card);
  });
}

function renderSaints(saints) {
  if (!saints.length) {
    saintsListEl.innerHTML = `
      <article class="saint-card">
        <p class="saint-life">
          Saints’ lives for this day are being prepared from authenticated Orthodox sources.
        </p>
      </article>`;
    return;
  }

  saintsListEl.innerHTML = "";

  saints.forEach((saint) => {
    const card = document.createElement("article");
    card.className = "saint-card";

    const header = document.createElement("div");
    header.className = "saint-header";

    if (saint.icon) {
      const img = document.createElement("img");
      img.src = saint.icon;
      img.alt = `${saint.name} icon`;
      header.appendChild(img);
    }

    const name = document.createElement("h3");
    name.className = "saint-name";
    name.textContent = saint.name;
    header.appendChild(name);

    card.appendChild(header);

    if (saint.life) {
      const lifeSection = document.createElement("div");
      const lifeTitle = document.createElement("p");
      lifeTitle.className = "saint-section-title";
      lifeTitle.textContent = "Life";
      const lifeText = document.createElement("p");
      lifeText.className = "saint-life";
      lifeText.textContent = saint.life;
      lifeSection.appendChild(lifeTitle);
      lifeSection.appendChild(lifeText);
      card.appendChild(lifeSection);
    }

    if (saint.troparion) {
      const troparionSection = document.createElement("div");
      const troparionTitle = document.createElement("p");
      troparionTitle.className = "saint-section-title";
      troparionTitle.textContent = "Troparion";
      const troparionText = document.createElement("p");
      troparionText.className = "saint-troparion";
      troparionText.textContent = saint.troparion;
      troparionSection.appendChild(troparionTitle);
      troparionSection.appendChild(troparionText);
      card.appendChild(troparionSection);
    }

    if (saint.kontakion) {
      const kontakionSection = document.createElement("div");
      const kontakionTitle = document.createElement("p");
      kontakionTitle.className = "saint-section-title";
      kontakionTitle.textContent = "Kontakion";
      const kontakionText = document.createElement("p");
      kontakionText.className = "saint-kontakion";
      kontakionText.textContent = saint.kontakion;
      kontakionSection.appendChild(kontakionTitle);
      kontakionSection.appendChild(kontakionText);
      card.appendChild(kontakionSection);
    }

    if (saint.prayer) {
      const prayerSection = document.createElement("div");
      const prayerTitle = document.createElement("p");
      prayerTitle.className = "saint-section-title";
      prayerTitle.textContent = "Prayer";
      const prayerText = document.createElement("p");
      prayerText.className = "saint-prayer";
      prayerText.textContent = saint.prayer;
      prayerSection.appendChild(prayerTitle);
      prayerSection.appendChild(prayerText);
      card.appendChild(prayerSection);
    }

    if (saint.sources) {
      const sources = Object.entries(saint.sources)
        .map(([key, value]) => `${key[0].toUpperCase()}${key.slice(1)}: ${value}`)
        .join(" • ");
      const sourcesEl = document.createElement("p");
      sourcesEl.className = "source";
      sourcesEl.textContent = sources;
      card.appendChild(sourcesEl);
    }

    saintsListEl.appendChild(card);
  });
}

datePicker.addEventListener("change", (event) => {
  const selectedDate = new Date(event.target.value);
  if (Number.isNaN(selectedDate.getTime())) {
    return;
  }
  const key = toKey(selectedDate);
  renderDay(key);
});

setInitialDate();
