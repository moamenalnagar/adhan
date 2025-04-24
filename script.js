const prayerMap = {
  fajr:     { key: 'Fajr',    label: 'الفجر',    icon: 'fas fa-moon' },
  sunrise:  { key: 'Sunrise', label: 'الشروق',   icon: 'fas fa-sun' },
  dhuhr:    { key: 'Dhuhr',   label: 'الظهر',    icon: 'fas fa-sun' },
  asr:      { key: 'Asr',     label: 'العصر',    icon: 'fas fa-sun' },
  maghrib:  { key: 'Maghrib', label: 'المغرب',   icon: 'fas fa-cloud-sun' },
  isha:     { key: 'Isha',    label: 'العشاء',   icon: 'fas fa-moon' }
};

let playedPrayers = {};
let selectedAdhan = localStorage.getItem('selectedAdhan') || "الشيخ محمد صديق المنشاوي.mp3";
let isPreviewing = false;

async function updateTimes() {
  const citySelect = document.getElementById('city');
  const city = citySelect.value;
  try {
    const res = await fetch(
      `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Egypt&method=5`
    );
    const json = await res.json();
    const timings = json.data.timings;
    const timezone = json.data.meta.timezone;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const nowH = +parts.find(p => p.type === 'hour').value;
    const nowM = +parts.find(p => p.type === 'minute').value;
    const nowMinutes = nowH * 60 + nowM;

    let nextId = 'fajr';
    let nextPrayerTimeInMinutes = Infinity;

    const adhanAudio = document.getElementById('adhan-audio');
    const adhanToggle = document.getElementById('adhan-toggle');
    adhanAudio.src = selectedAdhan;
    const currentDate = now.toISOString().split('T')[0];

    for (const id of Object.keys(prayerMap)) {
      if (id === 'sunrise') continue;
      const [h, m] = timings[prayerMap[id].key].split(':').map(Number);
      const prayerTimeInMinutes = h * 60 + m;
      if (nowMinutes === prayerTimeInMinutes && !playedPrayers[`${currentDate}-${id}`] && adhanToggle.checked && !isPreviewing) {
        adhanAudio.play().catch(e => console.error('Error playing Adhan:', e));
        playedPrayers[`${currentDate}-${id}`] = true;
      }
    }

    const storedDate = Object.keys(playedPrayers)[0]?.split('-').slice(0, 3).join('-');
    if (storedDate && storedDate !== currentDate) {
      playedPrayers = {};
    }

    const orderedPrayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (const id of orderedPrayers) {
      const [h, m] = timings[prayerMap[id].key].split(':').map(Number);
      let prayerTimeInMinutes = h * 60 + m;
      let timeRemaining = prayerTimeInMinutes - nowMinutes;
      if (timeRemaining <= 0) {
        timeRemaining += 1440;
      }
      if (timeRemaining < nextPrayerTimeInMinutes) {
        nextId = id;
        nextPrayerTimeInMinutes = timeRemaining;
      }
    }

    Object.keys(prayerMap).forEach(id => {
      const info = prayerMap[id];
      const display = timings[info.key];
      const el = document.getElementById(id);

      const [h, m] = display.split(':').map(Number);
      let prayerTimeInMinutes = h * 60 + m;
      let timeRemaining = prayerTimeInMinutes - nowMinutes;
      if (timeRemaining <= 0) {
        timeRemaining += 1440;
      }

      const hoursRemaining = Math.floor(timeRemaining / 60);
      const minutesRemaining = timeRemaining % 60;
      const remainingText = `${hoursRemaining} ساعة و ${minutesRemaining} دقيقة`;

      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const formattedTime = `${hour12}:${m < 10 ? '0' : ''}${m} ${h >= 12 ? 'مساءً' : 'صباحًا'}`;

      el.innerHTML =
        `<i class="${info.icon} icon"></i>` +
        `<span>${info.label}</span>` +
        `<span>${formattedTime}</span>` +
        `<div class="time-remaining">${remainingText}</div>`;

      el.classList.toggle('active', id === nextId);
    });

    updateBackgroundBasedOnTime();
    updateHijriDate();

    const dateElement = document.getElementById('date');
    const readableDate = new Date().toLocaleDateString("ar-EG", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    dateElement.innerHTML = `<i class="fas fa-calendar-day"></i> ${readableDate} م`;

  } catch (e) {
    console.error('Error fetching prayer times:', e);
    document.getElementById('prayer-widget').innerHTML = '<p>تعذر تحميل بيانات أوقات الصلاة. الرجاء المحاولة لاحقاً.</p>';
  }
}

function updateBackgroundBasedOnTime() {
  const now = new Date();
  const hours = now.getHours();

  if (hours >= 6 && hours < 12) {
    document.body.className = 'morning';
  } else if (hours >= 12 && hours < 18) {
    document.body.className = 'afternoon';
  } else {
    document.body.className = 'evening';
  }
}

async function updateHijriDate() {
  try {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;

    const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${dateStr}`);
    const data = await res.json();

    if (data.code !== 200) {
      console.error("خطأ في تحميل البيانات: ", data.message);
      throw new Error("API Error");
    }

    const hijri = data.data.hijri;
    const hijriFormatted = `${hijri.weekday.ar}، ${convertNumbersToArabic(hijri.day)} ${hijri.month.ar} ${convertNumbersToArabic(hijri.year)} هـ`;

    const hijriElement = document.getElementById('hijri-date');
    hijriElement.innerHTML = `<i class="fas fa-moon"></i> ${hijriFormatted}`;
  } catch (err) {
    console.error("فشل جلب التاريخ الهجري:", err);
    document.getElementById('hijri-date').textContent = "تعذر تحميل التاريخ الهجري. الرجاء المحاولة لاحقًا.";
  }
}

function convertNumbersToArabic(num) {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().split('').map(digit => arabicNumbers[digit]).join('');
}

function toggleOptionsList() {
  const selectedOption = document.querySelector('.selected-option');
  const optionsList = document.querySelector('.options-list');
  selectedOption.classList.toggle('open');
  optionsList.classList.toggle('open');
}

function selectAdhan(adhanSrc, adhanLabel) {
  selectedAdhan = adhanSrc;
  localStorage.setItem('selectedAdhan', adhanSrc);
  localStorage.setItem('selectedAdhanLabel', adhanLabel);

  const selectedOption = document.querySelector('.selected-option span');
  selectedOption.textContent = adhanLabel;

  const adhanAudio = document.getElementById('adhan-audio');
  adhanAudio.src = selectedAdhan;
  adhanAudio.pause();
  adhanAudio.currentTime = 0;
  isPreviewing = false;

  const playButtons = document.querySelectorAll('.play-preview');
  playButtons.forEach(button => {
    button.textContent = '▶';
    button.setAttribute('onclick', `previewAdhan('${button.getAttribute('onclick').match(/'([^']+)'/)[1]}')`);
  });

  toggleOptionsList();
}

function previewAdhan(adhanSrc) {
  const adhanAudio = document.getElementById('adhan-audio');
  const playButtons = document.querySelectorAll('.play-preview');

  adhanAudio.pause();
  adhanAudio.currentTime = 0;

  adhanAudio.src = adhanSrc;

  isPreviewing = true;
  adhanAudio.play().catch(e => console.error('Error playing Adhan preview:', e));

  playButtons.forEach(button => {
    if (button.getAttribute('onclick').includes(adhanSrc)) {
      button.textContent = '⏹';
      button.setAttribute('onclick', `stopPreviewAdhan('${adhanSrc}')`);
    } else {
      button.textContent = '▶';
      button.setAttribute('onclick', `previewAdhan('${button.getAttribute('onclick').match(/'([^']+)'/)[1]}')`);
    }
  });

  adhanAudio.onended = () => {
    isPreviewing = false;
    playButtons.forEach(button => {
      button.textContent = '▶';
      button.setAttribute('onclick', `previewAdhan('${button.getAttribute('onclick').match(/'([^']+)'/)[1]}')`);
    });
  };
}

function stopPreviewAdhan(adhanSrc) {
  const adhanAudio = document.getElementById('adhan-audio');
  const playButtons = document.querySelectorAll('.play-preview');

  adhanAudio.pause();
  adhanAudio.currentTime = 0;
  isPreviewing = false;

  playButtons.forEach(button => {
    button.textContent = '▶';
    button.setAttribute('onclick', `previewAdhan('${button.getAttribute('onclick').match(/'([^']+)'/)[1]}')`);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const citySelect = document.getElementById('city');
  const savedCity = localStorage.getItem('selectedCity');
  if (savedCity) {
    citySelect.value = savedCity;
  }
  citySelect.addEventListener('change', () => {
    localStorage.setItem('selectedCity', citySelect.value);
    updateTimes();
  });

  const savedAdhan = localStorage.getItem('selectedAdhan');
  const savedAdhanLabel = localStorage.getItem('selectedAdhanLabel');
  if (savedAdhan && savedAdhanLabel) {
    selectedAdhan = savedAdhan;
    const selectedOption = document.querySelector('.selected-option span');
    selectedOption.textContent = savedAdhanLabel;
  }

  updateTimes();

  const selectedOption = document.querySelector('.selected-option');
  selectedOption.addEventListener('click', toggleOptionsList);

  const options = document.querySelectorAll('.options-list li');
  options.forEach(option => {
    option.addEventListener('click', (event) => {
      if (option.querySelector('.play-preview').contains(event.target)) {
        return;
      }
      const adhanSrc = option.getAttribute('data-value');
      const adhanLabel = option.querySelector('span').textContent;
      selectAdhan(adhanSrc, adhanLabel);
    });
  });

  document.addEventListener('click', (event) => {
    const customSelect = document.querySelector('.custom-select');
    if (!customSelect.contains(event.target)) {
      const optionsList = document.querySelector('.options-list');
      const selectedOption = document.querySelector('.selected-option');
      optionsList.classList.remove('open');
      selectedOption.classList.remove('open');
    }
  });
});

setInterval(updateTimes, 60000);
