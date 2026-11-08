# Product Requirements Document (PRD)
# Bentengan Online

**Dokumen:** Product Requirements Document  
**Versi:** 1.0  
**Status:** Draft — baseline kebutuhan MVP  
**Tanggal:** 8 November 2026  
**Platform:** Web Browser (Desktop-first)  
**Bahasa dokumen:** Indonesia

---

## 1. Ringkasan Produk

**Bentengan Online** adalah game multiplayer 3D berbasis browser yang mengadaptasi permainan tradisional Bentengan Indonesia. Dua tim bertanding untuk mempertahankan benteng sendiri, menangkap pemain lawan, menyelamatkan rekan satu tim, dan menyentuh benteng lawan.

Game menggunakan perspektif **third-person**, visual **stylized/chibi 3D**, serta arena dengan tembok dan obstacle yang membentuk beberapa jalur pergerakan. Mekanik tambahan meliputi sprint dengan stamina, stun ketika stamina habis, dan immunity selama dua detik setelah pemain diselamatkan.

MVP menggunakan Vue 3, TypeScript, Three.js, Rapier 3D, dan PeerJS dengan model multiplayer **host-authoritative P2P**. Host adalah salah satu pemain yang menjalankan simulasi authoritative. Jika host terputus dan koneksi tidak pulih dalam batas waktu, pertandingan berakhir; host migration tidak termasuk MVP.

## 2. Visi dan Tujuan Produk

### 2.1 Visi

Menghadirkan pengalaman bermain Bentengan tradisional secara online yang mudah dipahami, seru dimainkan bersama teman, dan tetap memiliki unsur strategi, kerja sama, pengejaran, serta penyelamatan.

### 2.2 Tujuan MVP

1. Pemain dapat membuat dan bergabung ke room multiplayer.
2. Pemain dapat bertanding dalam format 4v4 atau 6v6.
3. Pemain dapat bergerak dalam arena 3D menggunakan kamera third-person.
4. Aturan inti Bentengan—menangkap, penjara, penyelamatan, dan merebut benteng—dapat dimainkan.
5. Mekanik sprint, stamina, stun, dan immunity berjalan konsisten untuk semua pemain.
6. Pertandingan dapat diselesaikan dengan kondisi kemenangan yang jelas.
7. Koneksi dan sinkronisasi cukup stabil untuk sesi multiplayer kasual.

### 2.3 Bukan tujuan MVP

- Ranked matchmaking atau sistem kompetitif berperingkat.
- Dedicated authoritative game server.
- Host migration.
- Banyak map atau procedural map generation.
- Sistem ekonomi, toko, battle pass, atau monetisasi.
- Kustomisasi karakter yang kompleks.
- Mobile-first control dan optimasi khusus perangkat mobile.
- Voice chat atau text chat bebas.
- Anti-cheat tingkat kompetitif.

## 3. Target Pengguna

### 3.1 Segmen utama

- Pemain kasual yang ingin bermain bersama teman.
- Pengguna yang mengenal permainan tradisional Bentengan.
- Kelompok pemain yang menyukai game multiplayer berbasis tim.
- Pengguna browser desktop yang ingin langsung bermain tanpa instalasi game native.

### 3.2 Kebutuhan pengguna

| Pengguna membutuhkan... | Agar dapat... |
|---|---|
| Membuat room | Mengundang teman ke pertandingan privat |
| Bergabung dengan kode room | Masuk ke pertandingan yang dibuat teman |
| Memilih tim | Bermain bersama rekan satu tim |
| Kontrol sederhana | Bergerak dan memahami permainan dengan cepat |
| HUD yang jelas | Mengetahui stamina, status, dan kondisi tim |
| Status penangkapan dan rescue yang jelas | Memahami apa yang terjadi selama pertandingan |
| Hasil pertandingan | Mengetahui tim pemenang dan statistik dasar |

## 4. Spesifikasi Produk

| Area | Persyaratan |
|---|---|
| Platform | Browser desktop |
| Perspektif | Third-person |
| Gaya visual | Stylized/chibi 3D |
| Framework UI | Vue 3 |
| Bahasa | TypeScript |
| Rendering | Three.js |
| Physics | Rapier 3D |
| Multiplayer transport | PeerJS / WebRTC |
| Topologi jaringan | Star: seluruh client terhubung ke host |
| Authority | Host-authoritative |
| Jumlah tim | 2 |
| Ukuran tim | 4 atau 6 pemain |
| Total pemain | 8 atau 12 pemain |
| Role | Tidak ada pembatasan role |
| Mode room | 4v4 atau 6v6, dipilih saat membuat room |
| Arena MVP | Satu arena simetris |
| Penjara | Area penjara terpisah untuk setiap tim |
| Jump | Aktif |
| Immunity setelah rescue | 2 detik |
| Stun saat stamina habis | 2 detik |
| Host disconnect | Match berakhir setelah timeout/reconnect window |

## 5. Gameplay dan Aturan

### 5.1 Struktur tim

- Setiap match memiliki dua tim: Blue dan Red.
- Setiap tim memiliki jumlah pemain yang sama.
- Room dibuat dengan kapasitas 8 pemain (4v4) atau 12 pemain (6v6).
- Pemain memilih tim selama lobby.
- Role karakter tidak dibatasi. Semua pemain memiliki kemampuan gameplay dasar yang sama.
- Match hanya dapat dimulai jika seluruh slot pemain terisi dan seluruh pemain berstatus ready. Untuk MVP, tidak ada start dengan tim tidak seimbang.

### 5.2 Kondisi kemenangan

Ada dua kondisi kemenangan:

**A. Base capture**
- Pemain yang masih bebas menyentuh area trigger benteng lawan.
- Pemain yang sedang `JAILED` tidak dapat memicu kemenangan.
- Pemain yang sedang `STUNNED` tidak dapat memicu kemenangan.
- Immunity tidak menghalangi pemain menyentuh benteng lawan.
- Sentuhan valid langsung mengakhiri pertandingan.

**B. Team elimination**
- Tim menang ketika seluruh pemain tim lawan berada dalam status `JAILED`.
- Pemain yang sedang `STUNNED` atau `IMMUNE` tetap dihitung sebagai pemain bebas.
- Pemain yang terputus tidak otomatis dihitung tertangkap.

**Penentuan hasil**
- Host memproses event dan kondisi kemenangan pada urutan tick yang konsisten.
- Match hanya boleh berakhir satu kali.
- Jika dua kondisi kemenangan terdeteksi pada tick yang sama, host memakai urutan event deterministik yang ditetapkan dalam game rules.
- Jika host disconnect, hasil match adalah `host_disconnect` dan tidak memberikan kemenangan kepada salah satu tim.

### 5.3 Penangkapan pemain

- Pemain hanya dapat menangkap pemain lawan.
- Pemain tidak dapat menangkap rekan satu tim.
- Target tidak dapat ditangkap jika sudah berada di penjara.
- Target tidak dapat ditangkap selama immunity aktif.
- Pemain yang sedang stun tetap dapat ditangkap.
- Penangkapan ditentukan host berdasarkan jarak dan state authoritative, bukan berdasarkan klaim client.
- Jarak capture awal: **1,5 meter**, dapat disesuaikan melalui playtesting.
- Setelah tertangkap, pemain masuk ke penjara milik timnya yang berada di wilayah lawan.

### 5.4 Penjara dan penyelamatan

- Setiap tim memiliki area penjara sendiri.
- Pemain Blue yang tertangkap ditempatkan di Jail Blue.
- Pemain Red yang tertangkap ditempatkan di Jail Red.
- Hanya rekan satu tim yang dapat menyelamatkan pemain di penjara.
- Rescuer harus berada dalam jarak maksimal awal **1,5 meter** dari target.
- Rescue harus divalidasi host.
- Setelah rescue valid, pemain keluar dari jail dan memperoleh immunity selama **2.000 ms**.
- Rescue tidak dapat dilakukan setelah match selesai.
- Request rescue duplikat tidak boleh menghasilkan beberapa event rescue atau memperpanjang immunity tanpa rescue baru yang valid.

### 5.5 Immunity

- Durasi: **2 detik** sejak rescue dikonfirmasi host.
- Immunity hanya diberikan kepada pemain yang diselamatkan.
- Pemain immune tidak dapat ditangkap.
- Pemain immune tetap dapat bergerak, sprint, jump, menyelamatkan rekan, dan menyentuh base lawan.
- Host menjadi sumber waktu yang otoritatif.
- Client hanya menampilkan countdown dan efek visual berdasarkan timestamp host.

### 5.6 Movement

Kontrol desktop MVP:

| Input | Aksi |
|---|---|
| W | Bergerak maju |
| S | Bergerak mundur |
| A | Bergerak kiri |
| D | Bergerak kanan |
| Shift | Sprint |
| Space | Jump |
| Mouse | Mengatur arah kamera |
| Esc | Pause/menu |

Ketentuan:
- Movement relatif terhadap arah kamera.
- Karakter tidak boleh menembus obstacle.
- Jump menggunakan physics dan validasi host.
- Pemain tidak dapat bergerak atau jump saat `STUNNED` atau `JAILED`.
- Kontrol dan sensitivitas kamera dapat disesuaikan melalui settings sederhana.

### 5.7 Sprint, stamina, dan stun

Nilai awal untuk prototype:

| Parameter | Nilai awal |
|---|---:|
| Stamina maksimum | 100 |
| Kecepatan berjalan | 4,5 m/s |
| Kecepatan sprint | 7 m/s |
| Konsumsi stamina | 25 poin/detik |
| Regenerasi stamina | 18 poin/detik |
| Durasi stun | 2 detik |
| Regenerasi saat stun | 0 |
| Sprint saat stamina habis | Tidak diizinkan |

Aturan:
- Stamina berkurang hanya saat pemain benar-benar sprint.
- Stamina tidak berkurang saat berjalan atau diam.
- Ketika stamina mencapai nol, sprint berhenti dan stun dimulai.
- Selama stun, pemain tidak dapat bergerak, sprint, atau jump.
- Stamina tidak beregenerasi selama stun.
- Setelah stun selesai, regenerasi stamina dimulai.
- Pemain tidak dapat terkena stun berulang hanya karena stamina masih nol.
- Pemain yang stun tetap dapat ditangkap.

Nilai movement dan stamina merupakan konfigurasi awal dan wajib diuji melalui playtesting.

## 6. Arena dan Level Design

### 6.1 Kebutuhan arena MVP

Arena pertama harus:
- Simetris untuk kedua tim.
- Memiliki dua benteng yang jelas.
- Memiliki dua area penjara.
- Memiliki central battle area.
- Memiliki minimal dua jalur alternatif menuju benteng lawan.
- Memiliki obstacle yang menghalangi jalur lurus tanpa menutup semua akses.
- Memiliki spawn point yang adil dan tidak terlalu dekat dengan lawan.
- Memiliki batas arena yang mencegah pemain keluar dari map.

### 6.2 Obstacle

| Obstacle | Collision | Interaksi |
|---|---|---|
| Tembok batu | Solid | Tidak dapat dilewati |
| Pagar rendah | Solid | Dapat dilompati jika ditandai sebagai jumpable |
| Peti kayu | Solid | Penghalang atau cover |
| Batu besar | Solid | Penghalang |
| Pohon | Collider pada batang | Tidak dapat ditembus |
| Rumput/dekorasi | Umumnya non-solid | Dekoratif |

Collider gameplay harus sederhana dan terpisah dari mesh visual. Gunakan box, capsule, atau collider sederhana lain sesuai kebutuhan.

### 6.3 Kriteria penerimaan arena

- Kedua tim memiliki jarak tempuh yang seimbang menuju base lawan.
- Tidak ada jalur yang dapat ditutup sepenuhnya oleh satu pemain.
- Pemain dapat mencapai jail lawan untuk melakukan rescue.
- Tidak ada collider yang membuat pemain terjebak tanpa jalan keluar.
- Kamera tidak menembus tembok secara signifikan.
- Collision visual dan collision physics cukup sesuai.

## 7. Camera, Character, dan UI

### 7.1 Third-person camera

Persyaratan:
- Kamera mengikuti karakter.
- Mouse mengontrol yaw dan pitch.
- Kamera memiliki smoothing.
- Kamera memiliki collision handling terhadap obstacle.
- Kamera tidak boleh terbalik atau berputar tidak terkendali.
- Sensitivitas dan jarak kamera memiliki nilai default yang nyaman.

### 7.2 Character presentation

Setiap pemain ditampilkan dengan:
- Model karakter 3D stylized/chibi.
- Identitas warna tim yang mudah dibedakan.
- Username atau nameplate.
- Animasi idle, walk, run, jump, fall, land, stun, captured/jailed, rescued, dan celebrate.
- Efek visual immunity.
- Efek visual stun.

Animasi visual diturunkan dari state gameplay dan tidak menjadi sumber kebenaran status permainan.

### 7.3 HUD

HUD minimal menampilkan:
- Timer pertandingan.
- Identitas dan skor/status kedua tim.
- Jumlah pemain bebas dan tertangkap per tim.
- Stamina bar.
- Indikator sprint.
- Countdown immunity saat aktif.
- Indikator stun saat aktif.
- Notifikasi capture dan rescue.
- Indikator koneksi jaringan.
- Tombol pause/settings.

### 7.4 Menu dan halaman

| Halaman | Fungsi |
|---|---|
| Main Menu | Akses create room, join room, settings |
| Create Room | Memilih mode 4v4 atau 6v6 dan membuat room |
| Join Room | Memasukkan kode room |
| Lobby | Melihat pemain, memilih tim, ready |
| Game | Arena, karakter, HUD |
| Results | Pemenang, alasan kemenangan, statistik dasar |
| Settings | Sensitivitas kamera, audio, dan kualitas grafis |

## 8. Functional Requirements

Prioritas:
- **P0:** Wajib untuk MVP.
- **P1:** Penting, dapat menyusul setelah core MVP.
- **P2:** Pengembangan setelah MVP.

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|---|
| FR-001 | Create room | Host membuat room 4v4 atau 6v6 | P0 |
| FR-002 | Join room | Pemain bergabung menggunakan room code | P0 |
| FR-003 | Room capacity | Membatasi room pada 8 atau 12 pemain | P0 |
| FR-004 | Team selection | Pemain memilih Blue atau Red | P0 |
| FR-005 | Team balance | Mencegah jumlah tim tidak seimbang | P0 |
| FR-006 | Ready state | Pemain menyatakan siap | P0 |
| FR-007 | Match start | Match dimulai setelah syarat lobby terpenuhi | P0 |
| FR-008 | 3D movement | WASD movement | P0 |
| FR-009 | Camera | Third-person camera dengan mouse look | P0 |
| FR-010 | Collision | Karakter bertabrakan dengan obstacle | P0 |
| FR-011 | Jump | Pemain dapat melompat | P0 |
| FR-012 | Sprint | Shift mengaktifkan sprint | P0 |
| FR-013 | Stamina | Stamina berkurang dan beregenerasi | P0 |
| FR-014 | Stun | Stamina habis memicu stun 2 detik | P0 |
| FR-015 | Capture | Pemain dapat menangkap lawan | P0 |
| FR-016 | Jail | Pemain tertangkap masuk penjara timnya | P0 |
| FR-017 | Rescue | Rekan satu tim dapat menyelamatkan tahanan | P0 |
| FR-018 | Immunity | Rescue memberi immunity 2 detik | P0 |
| FR-019 | Base capture | Menyentuh base lawan mengakhiri match | P0 |
| FR-020 | Team elimination | Seluruh lawan jailed mengakhiri match | P0 |
| FR-021 | Snapshot sync | Host mengirim state berkala | P0 |
| FR-022 | Interpolation | Remote player bergerak mulus | P0 |
| FR-023 | Host disconnect | Match berakhir setelah timeout | P0 |
| FR-024 | Results | Menampilkan hasil match | P0 |
| FR-025 | Match statistics | Capture, rescue, times captured | P1 |
| FR-026 | Audio/VFX polish | Efek suara dan visual final | P1 |
| FR-027 | Character cosmetics | Kustomisasi kosmetik | P2 |
| FR-028 | Leaderboard | Statistik lintas pertandingan | P2 |

## 9. Non-Functional Requirements

### 9.1 Performance

Target awal pada perangkat desktop yang memenuhi spesifikasi minimum yang nantinya ditentukan:
- Rendering ditargetkan 60 FPS.
- Simulasi host berjalan pada fixed timestep 60 Hz.
- Snapshot jaringan ditargetkan 20 Hz.
- Mendukung 12 pemain dalam satu room.
- Menggunakan collider sederhana untuk obstacle.
- Menggunakan asset optimization, texture compression, dan level of detail jika diperlukan.
- Tidak membuat atau menghancurkan object 3D secara berlebihan di setiap frame.

### 9.2 Networking

- Seluruh gameplay-critical state divalidasi host.
- Pesan memiliki schema dan versioning.
- Pesan memiliki sequence number atau tick jika relevan.
- Snapshot lama tidak boleh menimpa snapshot yang lebih baru.
- Client menangani latency dan jitter melalui interpolation.
- Client lokal dapat menggunakan prediction dan reconciliation.
- Koneksi P2P harus diuji pada jaringan berbeda.
- STUN/TURN disiapkan untuk membantu konektivitas.
- Host heartbeat dan disconnect timeout wajib tersedia.

### 9.3 Reliability

- Game engine harus dapat dibersihkan dengan benar saat keluar dari scene.
- Disconnect client tidak boleh merusak state pemain lain.
- Duplicate event tidak boleh menggandakan hasil capture/rescue.
- Match hanya dapat selesai satu kali.
- Error koneksi ditampilkan dengan pesan yang dapat dimengerti pengguna.

### 9.4 Security

- Client tidak boleh menentukan hasil capture, rescue, stamina, immunity, atau kemenangan.
- Host memvalidasi movement, jarak, status, dan input.
- Semua network payload divalidasi.
- Request memiliki rate limit.
- Room join menggunakan token atau mekanisme otorisasi yang sesuai.
- Kredensial TURN tidak boleh berupa secret permanen yang ditanam di frontend.
- Host-authoritative P2P tidak dianggap tahan terhadap host yang dimodifikasi.

### 9.5 Accessibility dan usability

- Kontrol dasar mudah ditemukan.
- Status pemain dibedakan melalui teks/ikon dan warna, bukan warna saja.
- HUD memiliki kontras yang memadai.
- Pengaturan sensitivitas kamera tersedia.
- Pesan error menggunakan bahasa yang jelas.

## 10. Multiplayer dan Networking Requirements

### 10.1 Topologi

MVP menggunakan topologi star:
- Host membuka koneksi ke setiap client.
- Setiap client hanya terhubung ke host.
- Host mengirim snapshot dan event gameplay.
- Client mengirim input dan request interaksi.

Untuk 12 pemain, host mengelola maksimal 11 koneksi pemain.

### 10.2 Tanggung jawab host

Host bertanggung jawab atas:
- Registrasi pemain dalam match.
- Validasi input.
- Simulasi movement authoritative.
- Collision gameplay.
- Stamina dan stun.
- Capture dan rescue.
- Jail dan immunity.
- Victory condition.
- Match lifecycle.
- Snapshot publication.

### 10.3 Jenis pesan minimum

Client ke host:
- `JOIN_ROOM`
- `PLAYER_READY`
- `PLAYER_INPUT`
- `RESCUE_REQUEST`
- `PING`

Host ke client:
- `ROOM_STATE`
- `MATCH_STARTED`
- `WORLD_SNAPSHOT`
- `PLAYER_CAPTURED`
- `PLAYER_RESCUED`
- `PLAYER_STUNNED`
- `MATCH_ENDED`
- `ERROR`
- `PONG`

Pesan gameplay penting harus memiliki identifier/tick agar event duplikat dan event terlambat dapat ditangani.

### 10.4 Room directory

PeerJS tidak menyediakan room discovery atau matchmaking. Produk membutuhkan room directory melalui API atau service terpisah.

Data minimum:
- Room code.
- Host Peer ID.
- Mode/capacity.
- Jumlah pemain.
- Status room.
- Waktu terakhir heartbeat.
- Expiration/TTL.

Room directory bukan game authority. Ia hanya membantu pemain menemukan host dan informasi room.

### 10.5 Host disconnect

- Client memantau koneksi host melalui heartbeat.
- Saat koneksi hilang, client mencoba reconnect dalam batas waktu yang ditetapkan.
- Jika host tidak kembali, match berakhir dengan reason `host_disconnect`.
- Tidak ada host migration dalam MVP.
- Room directory menghapus atau menandai room tidak aktif setelah heartbeat kedaluwarsa.
- Hasil `host_disconnect` tidak memberikan kemenangan kepada tim mana pun.

## 11. Technical Architecture

### 11.1 Technology stack

| Komponen | Teknologi |
|---|---|
| Frontend | Vue 3 |
| Language | TypeScript |
| Build tool | Vite |
| UI state | Pinia |
| 3D rendering | Three.js |
| Physics | Rapier 3D |
| Multiplayer | PeerJS |
| Signaling | PeerServer |
| Validation | Zod |
| Unit tests | Vitest |
| E2E tests | Playwright |
| Optional account API | Laravel |
| Optional room directory | Laravel API atau Node.js service |
| Database jika diperlukan | PostgreSQL atau MySQL |

Three.js native menjadi pendekatan rendering utama. Vue menangani UI dan application lifecycle. Game simulation tidak dijalankan melalui reactive component update setiap frame.

### 11.2 High-level architecture

```text
Browser Client
├── Vue Application
│   ├── Pages
│   ├── Components
│   └── Pinia UI Stores
│
├── Game Runtime
│   ├── Game Engine
│   ├── Three.js Renderer
│   ├── Rapier Physics
│   ├── Input Manager
│   ├── Camera Controller
│   └── Gameplay Systems
│
└── Multiplayer Client
    ├── PeerJS Manager
    ├── Room Manager
    ├── Protocol Validation
    ├── Snapshot Interpolation
    └── Client Prediction

Infrastructure
├── Room Directory API
├── PeerServer Signaling
├── STUN/TURN
└── Optional Laravel Account API
```

### 11.3 Suggested source structure

```text
src/
├── app/
├── pages/
├── components/
├── stores/
├── services/
├── game/
│   ├── core/
│   ├── scenes/
│   ├── entities/
│   ├── systems/
│   ├── physics/
│   ├── camera/
│   ├── input/
│   ├── animation/
│   └── rendering/
├── network/
│   ├── peer/
│   ├── room/
│   ├── host/
│   ├── protocol/
│   └── synchronization/
├── types/
└── utils/
```

### 11.4 Game simulation

- Fixed timestep: 60 Hz.
- Network snapshot: 20 Hz.
- Rendering: requestAnimationFrame.
- Host simulation scheduler harus terpisah dari rendering.
- Physics dijalankan dengan timestep tetap.
- Snapshot memiliki tick dan host timestamp.
- Client menginterpolasi remote player.
- Local player dapat menggunakan prediction dan reconciliation.

Urutan tick host:
1. Mengambil input yang diterima.
2. Memvalidasi sequence dan input.
3. Memproses movement.
4. Memproses stamina dan sprint.
5. Memproses jump dan gravity.
6. Menjalankan physics.
7. Memproses capture/rescue request.
8. Memperbarui immunity dan stun.
9. Mengevaluasi kemenangan.
10. Mengirim snapshot sesuai jadwal.

Urutan detail event harus ditetapkan dan diuji agar hasil pada tick yang sama deterministik.

## 12. Data Model Minimum

### 12.1 Player

```ts
type TeamId = 'blue' | 'red';

type PlayerStatus =
  | 'normal'
  | 'stunned'
  | 'jailed';

interface PlayerState {
  id: string;
  peerId: string;
  username: string;
  teamId: TeamId;

  position: [number, number, number];
  velocity: [number, number, number];
  rotation: number;

  status: PlayerStatus;

  stamina: number;
  isSprinting: boolean;
  isGrounded: boolean;

  immunityUntil: number;
  stunUntil: number;

  capturedBy: string | null;
}
```

Jump/airborne dan sprint sebaiknya menjadi atribut movement terpisah, bukan state utama yang saling meniadakan. Immunity juga merupakan timed condition, bukan status utama yang menggantikan `normal`.

### 12.2 Room

```ts
interface Room {
  id: string;
  roomCode: string;
  hostPeerId: string;

  maxPlayers: 8 | 12;

  status:
    | 'waiting'
    | 'starting'
    | 'playing'
    | 'finished';

  players: RoomPlayer[];
  createdAt: number;
}
```

### 12.3 Match result

```ts
type MatchEndReason =
  | 'base_capture'
  | 'team_elimination'
  | 'host_disconnect';

interface MatchResult {
  matchId: string;
  winner: TeamId | null;
  reason: MatchEndReason;
  duration: number;

  players: Array<{
    playerId: string;
    teamId: TeamId;
    captures: number;
    rescues: number;
    timesCaptured: number;
  }>;
}
```

### 12.4 Timestamp

- Gameplay timer authoritative menggunakan host monotonic clock.
- Timestamp dikirim sebagai waktu relatif/monotonic yang konsisten untuk sesi match.
- Client tidak boleh menggunakan jam lokal sebagai sumber kebenaran immunity atau stun.
- Jika diperlukan untuk penyimpanan riwayat, waktu kalender dicatat terpisah.

## 13. Acceptance Criteria

MVP dinyatakan memenuhi kebutuhan apabila:

### Lobby
- [ ] Host dapat membuat room 4v4.
- [ ] Host dapat membuat room 6v6.
- [ ] Pemain dapat join menggunakan room code.
- [ ] Room menolak pemain melebihi kapasitas.
- [ ] Pemain dapat memilih tim.
- [ ] Tim tidak dapat memulai dengan jumlah tidak seimbang.
- [ ] Match hanya dimulai ketika seluruh slot terisi dan ready.

### Movement
- [ ] Pemain dapat bergerak dengan WASD.
- [ ] Kamera mengikuti karakter dan dapat dikontrol mouse.
- [ ] Karakter tidak menembus obstacle.
- [ ] Jump dapat digunakan sesuai aturan.
- [ ] Sprint menggunakan stamina.
- [ ] Stamina beregenerasi sesuai aturan.
- [ ] Stamina habis memicu stun 2 detik.

### Gameplay
- [ ] Pemain dapat menangkap lawan.
- [ ] Pemain tidak dapat menangkap rekan.
- [ ] Pemain tertangkap masuk jail timnya.
- [ ] Rekan satu tim dapat melakukan rescue.
- [ ] Rescue memberi immunity tepat 2 detik berdasarkan host clock.
- [ ] Pemain immune tidak dapat ditangkap.
- [ ] Pemain stun tetap dapat ditangkap.
- [ ] Menyentuh base lawan secara valid mengakhiri match.
- [ ] Seluruh lawan jailed mengakhiri match.
- [ ] Match tidak berakhir lebih dari sekali.

### Multiplayer
- [ ] 8 pemain dapat bermain dalam satu room.
- [ ] 12 pemain dapat bermain dalam satu room.
- [ ] Semua client menerima state yang konsisten.
- [ ] Snapshot lama tidak menimpa state baru.
- [ ] Request duplikat tidak menggandakan event.
- [ ] Host disconnect terdeteksi.
- [ ] Match berakhir jika host tidak kembali dalam timeout.
- [ ] Tidak ada host migration.

### UI
- [ ] HUD menampilkan stamina.
- [ ] HUD menampilkan status immunity dan stun.
- [ ] HUD menampilkan jumlah pemain bebas/jailed.
- [ ] Hasil pertandingan menampilkan pemenang atau status tanpa pemenang jika host disconnect.

## 14. Test Plan

### 14.1 Unit tests

Uji secara terpisah:
- Movement validation.
- Sprint drain.
- Stamina regeneration.
- Stun transition.
- Capture validation.
- Rescue validation.
- Immunity expiration.
- Jail transition.
- Base capture victory.
- Team elimination victory.
- Match end idempotency.
- Network message schema validation.

### 14.2 Integration tests

- Capture lalu rescue.
- Rescue lalu immunity expiration.
- Sprint sampai stamina habis.
- Stun lalu recovery.
- Capture ketika target stun.
- Capture ketika target immune.
- Simultaneous capture/rescue requests.
- Simultaneous victory events.
- Player disconnect ketika match berlangsung.
- Host disconnect dan timeout.

### 14.3 E2E tests

- Create room → join room → select teams → ready → start.
- Selesaikan match melalui base capture.
- Selesaikan match melalui team elimination.
- Host disconnect → seluruh client melihat match berakhir.
- Jalankan skenario 4v4 dan 6v6.

### 14.4 Network condition tests

Uji:
- Latency normal.
- Latency tinggi.
- Jitter.
- Packet delay.
- Koneksi terputus sementara.
- NAT/firewall yang memerlukan TURN.
- Browser tab menjadi background.
- Host mengalami penurunan FPS.

## 15. Analytics dan Statistik

Untuk MVP, statistik minimum yang dapat ditampilkan:
- Jumlah capture.
- Jumlah rescue.
- Jumlah times captured.
- Durasi match.
- Tim pemenang.
- Alasan pertandingan berakhir.

Statistik yang berasal dari gameplay harus dicatat oleh host. Jika hasil akan disimpan sebagai data permanen atau leaderboard, perlu ada validasi tambahan karena host P2P bukan authority yang sepenuhnya terpercaya.

## 16. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Host keluar | Match terhenti | Heartbeat dan timeout |
| NAT/firewall | Peer tidak dapat terkoneksi | STUN/TURN |
| Host dimodifikasi | Hasil match dapat dimanipulasi | Batasi MVP untuk kasual; dedicated server untuk kompetitif |
| Snapshot terlambat | Gerakan tidak mulus | Interpolation dan sequence |
| Physics berbeda antar-client | Desync | Host authoritative |
| Duplicate request | Capture/rescue ganda | Event ID dan idempotency |
| Arena tidak seimbang | Salah satu tim unggul | Arena simetris dan playtesting |
| Performa browser | FPS turun | Asset optimization dan profiling |
| Tab background | Simulation/rendering melambat | Host scheduler terpisah dan timeout policy |

## 17. Development Roadmap

### Milestone 1 — Project Foundation
- Setup Vue 3, TypeScript, Vite.
- Setup Three.js.
- Setup Rapier.
- Buat GameEngine lifecycle.
- Buat arena greybox.
- Buat karakter placeholder.
- Implementasi camera dan movement.

**Exit criteria:** satu pemain dapat bergerak, jump, dan bertabrakan dengan obstacle.

### Milestone 2 — Core Gameplay
- Sprint dan stamina.
- Stun.
- Dua tim.
- Base dan jail.
- Capture.
- Rescue.
- Immunity.
- Victory conditions.

**Exit criteria:** seluruh gameplay dapat diuji secara lokal dengan simulasi beberapa karakter.

### Milestone 3 — Multiplayer Foundation
- PeerServer.
- PeerJS connection.
- Room directory.
- Create/join room.
- Team selection.
- Host authority.
- Protocol validation.

**Exit criteria:** beberapa client dapat masuk ke room dan menerima state lobby.

### Milestone 4 — Multiplayer Gameplay
- Input transmission.
- Host simulation.
- Snapshot publication.
- Interpolation.
- Prediction/reconciliation.
- Capture/rescue synchronization.
- Host disconnect handling.

**Exit criteria:** pertandingan dapat dimainkan lintas client dengan aturan yang konsisten.

### Milestone 5 — Scale and Stabilization
- Uji 4v4.
- Uji 6v6.
- Uji latency dan packet loss.
- Uji TURN.
- Optimasi rendering dan physics.
- Perbaiki bug dan desync.

**Exit criteria:** target 12 pemain tercapai pada lingkungan pengujian yang ditentukan.

### Milestone 6 — Visual Polish
- Final character models.
- Animasi.
- Arena assets.
- VFX dan audio.
- HUD final.
- Settings dan hasil pertandingan.

**Exit criteria:** MVP siap untuk playtest eksternal.

## 18. Definition of Done

Sebuah fitur dianggap selesai jika:
1. Implementasi sesuai requirement dan aturan gameplay.
2. TypeScript typecheck berhasil.
3. Unit test untuk logic terkait tersedia dan lulus.
4. Integration test tersedia jika fitur melibatkan beberapa sistem.
5. Tidak ada error console yang diketahui pada alur normal.
6. Network payload divalidasi jika fitur melibatkan multiplayer.
7. Lifecycle dan cleanup ditangani.
8. UI memiliki loading, error, dan state yang sesuai.
9. Acceptance criteria fitur terpenuhi.

## 19. Open Decisions

Hal berikut belum dikunci dan harus diputuskan sebelum atau selama implementasi terkait:

| Topik | Status | Catatan |
|---|---|---|
| Durasi maksimum match | Belum ditentukan | Tentukan apakah match dapat berlangsung tanpa batas |
| Tie/timeout rules | Belum ditentukan | Dibutuhkan jika durasi maksimum diterapkan |
| Capture cooldown | Perlu playtest | Hindari capture berulang pada kondisi edge |
| Rescue cooldown | Perlu playtest | Mencegah request spam |
| Spawn placement | Perlu level design | Harus adil dan aman |
| Room privacy/password | Belum ditentukan | Public/private room |
| Disconnect pemain non-host | Belum ditentukan | Reconnect, slot kosong, atau dianggap keluar |
| Minimum browser | Belum ditentukan | Tetapkan setelah profiling |
| Minimum hardware | Belum ditentukan | Tetapkan setelah profiling |
| Mobile support | Di luar MVP | Evaluasi setelah desktop MVP |
| Account system | Opsional untuk MVP | Guest mode dapat digunakan terlebih dahulu |

## 20. Glossary

| Istilah | Definisi |
|---|---|
| Base | Benteng yang harus dipertahankan dan direbut |
| Jail | Area tempat pemain tertangkap |
| Capture | Menangkap pemain lawan |
| Rescue | Membebaskan rekan dari jail |
| Immunity | Perlindungan sementara setelah rescue |
| Stamina | Energi untuk melakukan sprint |
| Stun | Kondisi sementara ketika pemain tidak dapat bergerak |
| Host | Pemain yang menjalankan authoritative simulation |
| Peer | Endpoint koneksi WebRTC |
| Signaling | Proses membantu peer menemukan dan membangun koneksi |
| Snapshot | Gambaran state game pada tick tertentu |
| Interpolation | Memperhalus gerakan berdasarkan beberapa snapshot |
| Prediction | Simulasi lokal untuk mengurangi input latency |
| Reconciliation | Koreksi state lokal berdasarkan hasil authoritative |

---

## Appendix A — Baseline Configuration

Nilai berikut menjadi konfigurasi awal yang dapat diubah tanpa mengubah struktur sistem:

```ts
export const GAME_CONFIG = {
  teamSizes: [4, 6] as const,

  simulationHz: 60,
  snapshotHz: 20,

  movement: {
    walkSpeed: 4.5,
    sprintSpeed: 7,
    jumpHeight: 1.2,
    gravity: 9.81,
  },

  stamina: {
    max: 100,
    sprintDrainPerSecond: 25,
    regenerationPerSecond: 18,
  },

  gameplay: {
    captureRadius: 1.5,
    rescueRadius: 1.5,
    immunityDurationMs: 2000,
    stunDurationMs: 2000,
  },

  networking: {
    hostReconnectWindowMs: 10000,
    heartbeatIntervalMs: 2000,
  },
} as const;
```

`hostReconnectWindowMs` dan `heartbeatIntervalMs` merupakan nilai awal yang perlu divalidasi dalam pengujian jaringan.

## Appendix B — Product Scope Summary

**MVP harus membuktikan tiga hal utama:**

1. **Gameplay:** permainan Bentengan terasa benar, menyenangkan, dan seimbang.
2. **Multiplayer:** 8–12 pemain dapat bermain bersama dengan state yang konsisten.
3. **Technical foundation:** arsitektur cukup modular untuk menambahkan map, kosmetik, statistik, dan fitur sosial tanpa menulis ulang core game.

Prioritas utama bukan jumlah fitur, melainkan kestabilan movement, capture, rescue, stamina, immunity, dan sinkronisasi multiplayer.
