# <img src="https://api.iconify.design/material-symbols:calendar-month-outline.svg?color=%23F59E0B" width="28" height="28" align="center" /> Tool-Crunchyroll-Schedule-2026 (Crunchyroll Schedule to iCalendar Feed)

<div align="center">

[![Language: Node.js](https://img.shields.io/badge/Runtime-Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![API: AniList GraphQL](https://img.shields.io/badge/Data%20Source-AniList%20GraphQL-02A9FF?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.anilist.co)
[![Format: iCalendar .ics](https://img.shields.io/badge/Output-iCalendar%20.ics-E50914?style=for-the-badge&logo=googlecalendar&logoColor=white)](https://icalendar.org/)
[![Hosting: Render](https://img.shields.io/badge/Hosting-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**ระบบดึงและแปลงตารางฉายอนิเมะลิขสิทธิ์สตรีมมิ่งบน Crunchyroll เป็นปฏิทิน iCalendar (.ics)**  
*ซิงค์กำหนดการออกอากาศตรงเข้า Google Calendar, Apple Calendar, หรือ Outlook ได้อัตโนมัติ*

[🐛 แจ้งปัญหา (Report Bug)](https://github.com/PhuriphatTyPeZ3r0/Tool-Crunchyroll-Schedule-2026/issues) · [✨ เสนอแนะฟีเจอร์ (Request Feature)](https://github.com/PhuriphatTyPeZ3r0/Tool-Crunchyroll-Schedule-2026/issues)

</div>

---

## <img src="https://api.iconify.design/material-symbols:list-alt-outline.svg?color=%236366F1" width="20" height="20" align="center" /> สารบัญ (Table of Contents)
- [📖 เกี่ยวกับโปรเจกต์ (About The Project)](#-เกี่ยวกับโปรเจกต์-about-the-project)
- [✨ ฟีเจอร์หลัก (Key Features)](#-ฟีเจอร์หลัก-key-features)
- [📡 แหล่งข้อมูลและการบายพาส (Data Source & Anti-Bot Strategy)](#-แหล่งข้อมูลและการบายพาส-data-source--anti-bot-strategy)
- [🛠️ สถาปัตยกรรมและเทคโนโลยี (Architecture)](#️-สถาปัตยกรรมและเทคโนโลยี-architecture)
- [🚀 การติดตั้งและเริ่มต้นใช้งาน (Getting Started)](#-การติดตั้งและเริ่มต้นใช้งาน-getting-started)
- [🌐 การนำไปใช้งานและซิงค์ปฏิทิน (Subscription Guide)](#-การนำไปใช้งานและซิงค์ปฏิทิน-subscription-guide)
- [👨‍💻 ผู้พัฒนา (Author)](#-ผู้พัฒนา-author)

---

## 📖 เกี่ยวกับโปรเจกต์ (About The Project)

> **ที่มาและปัญหา (Problem Statement):**  
> ผู้ชมอนิเมะส่วนใหญ่ต้องคอยเปิดแอปหรือเช็กเว็บไซต์ทีละแห่งเพื่อดูว่าอนิเมะเรื่องที่กำลังติดตามจะปล่อยตอนใหม่ในวันและเวลาใด อีกทั้ง Crunchyroll ไม่มีระบบส่งออกตารางปฏิทินสากล (.ics feed) สำหรับซิงค์เข้า Google Calendar ของผู้ใช้โดยตรง

**แนวทางการแก้ไข (Solution):**  
**Tool-Crunchyroll-Schedule-2026** ให้บริการฟีดปฏิทิน `.ics` อัตโนมัติ:
- ดึงข้อมูลตารางเวลาฉายจริง (Simulcast broadcast times)
- กรองเฉพาะรายการที่สตรีมมิ่งบน Crunchyroll
- สร้าง UID เสถียรสำหรับแต่ละ Episode พร้อมระบุเวลาสากลแบบ UTC
- ให้บริการผ่าน HTTP Endpoint ที่สามารถนำ URL ไป Subscribe ใน Google Calendar หรือ Apple Calendar ได้ทันที

---

## ✨ ฟีเจอร์หลัก (Key Features)

- [x] 🔄 **Automatic Calendar Sync:** อัปเดตตารางเวลาฉายของแต่ละสัปดาห์เข้าปฏิทินของผู้ใช้อัตโนมัติ
- [x] ⚡ **High-Performance Caching:** แคชข้อมูลในหน่วยความจำ (In-Memory Soft-TTL Cache) เสิร์ฟไวไม่หน่วง
- [x] 🛡️ **Stable Episode UIDs:** ป้องกันการเกิด Event ซ้ำซ้อน (Duplicate Events) ในปฏิทิน
- [x] 🌍 **Timezone-Aware (UTC):** จัดการเวลาตามมาตรฐานสากล แปลงเป็นเวลาท้องถิ่นของอุปกรณ์ผู้ใช้โดยอัตโนมัติ

---

## 📡 แหล่งข้อมูลและการบายพาส (Data Source & Anti-Bot Strategy)

Crunchyroll API ภายในติดตั้งระบบป้องกัน **Cloudflare Bot Management (TLS/JA3 Fingerprinting)** ซึ่งบล็อกคำขอระดับ HTTP ปกติทั้งหมด (HTTP 403) 

โปรเจกต์นี้จึงเลือกใช้สถาปัตยกรรม **Public GraphQL Aggregation**:
- เชื่อมต่อผ่าน **AniList Public GraphQL API** (`https://graphql.anilist.co`) ที่เปิดกว้างและเสถียร
- ทำการ Filter สตรีมมิ่งลิงก์ที่ระบุผู้ให้บริการเป็น Crunchyroll
- แนบ Direct Link ตรงกลับไปยังหน้าดูของ Crunchyroll ในรายละเอียดของทุก Event

---

## 🛠️ สถาปัตยกรรมและเทคโนโลยี (Architecture)

```mermaid
graph LR
    AniList["🌐 AniList GraphQL API"] --> Fetcher["⚙️ scheduleData.js (Fetch & Filter)"]
    Fetcher --> Cache["📦 calendarGenerator.js (In-Memory TTL Cache)"]
    Cache --> Server["🚀 Express / Node.js Server"]
    Server --> ICSFeed["📅 /api/calendar/crunchyroll.ics"]
    ICSFeed --> GoogleCal["📱 Google Calendar / Apple Calendar"]
```

---

## 🚀 การติดตั้งและเริ่มต้นใช้งาน (Getting Started)

### ขั้นตอนการรันบนเครื่อง Local
1. **โคลน Repository:**
   ```bash
   git clone https://github.com/PhuriphatTyPeZ3r0/Tool-Crunchyroll-Schedule-2026.git
   cd Tool-Crunchyroll-Schedule-2026
   ```

2. **ติดตั้ง Dependencies:**
   ```bash
   npm install
   ```

3. **รันเซิร์ฟเวอร์:**
   ```bash
   npm start
   ```

4. ทดสอบ Endpoint ได้ที่: `http://localhost:3000/api/calendar/crunchyroll.ics`

---

## 🌐 การนำไปใช้งานและซิงค์ปฏิทิน (Subscription Guide)

1. Deploy โค้ดนี้ไปยังบริการคลาวด์ฟรี (เช่น [Render](https://render.com))
2. คัดลอก URL ของฟีด: `https://<your-service>.onrender.com/api/calendar/crunchyroll.ics`
3. ใน **Google Calendar**:
   - ไปที่เมนูด้านซ้าย **Other calendars (+)** ➔ **From URL**
   - วาง URL ลงไป แล้วกด **Add calendar**
   - กำหนดการฉายอนิเมะจะปรากฏและอัปเดตบนมือถือของคุณตลอดทั้งฤดูกาล!

---

## <img src="https://api.iconify.design/material-symbols:person-outline.svg?color=%2306B6D4" width="22" height="22" align="center" /> ผู้พัฒนา (Author)

**Phuriphat Hemakul (PhuriphatTyPeZ3r0)**
- <img src="https://api.iconify.design/material-symbols:school-outline.svg?color=%230284C7" width="16" height="16" align="center" /> นักศึกษา สาขาวิศวกรรมคอมพิวเตอร์และปัญญาประดิษฐ์ (CAI)
- <img src="https://api.iconify.design/material-symbols:apartment-rounded.svg?color=%230284C7" width="16" height="16" align="center" /> สถาบันการจัดการปัญญาภิวัฒน์ (PIM)
- <img src="https://api.iconify.design/simple-icons:github.svg?color=%23181717" width="16" height="16" align="center" /> GitHub: [@PhuriphatTyPeZ3r0](https://github.com/PhuriphatTyPeZ3r0)
- <img src="https://api.iconify.design/material-symbols:language.svg?color=%233B82F6" width="16" height="16" align="center" /> Portfolio: [portfolio-phuriphatizamus-projects.vercel.app](https://portfolio-phuriphatizamus-projects.vercel.app)
