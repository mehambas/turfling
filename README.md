# Halı Saha Turnuvası

15 kişi, 3 takım için turnuva takip ekranı: kura, canlı skor ve süre, puan durumu, fikstür, gol krallığı, zaman planı.
Build adımı yok; düz HTML/CSS/JS.

## Çalıştırma

`index.html` dosyasına çift tıklamak yeterli. İnternet gerekmez; veriler tarayıcıda (localStorage) saklanır.
Sayfa kapanıp açılsa da kaldığı yerden devam eder. Turnuva öncesinde ve sonrasında *Kurulum → Yedek → İndir* önerilir.

## Yayın ekranı (TV / projektör)

Üst çubuktaki ekran simgesi `index.html#ekran` adresini yeni pencerede açar: büyük skor, süre ve sıradaki maç.
Salt okunurdur; sağ üstteki *Fikstür* düğmesi fikstürü gösterir, yanındaki düğme tam ekrana geçirir.
Aynı tarayıcıda açık olduğu sürece skorlar anlık güncellenir. Ses yalnızca yönetim ekranında çalar.

## Format (varsayılan)

- Lig: 2 devre, her takım diğer ikisiyle 2 kez oynar (6 maç × 12 dk). Sıra A–B, C–A, B–C: kimse üst üste 3 maç oynamaz.
- Playoff: lig 2.si – 3.sü (10 dk), kazanan finale çıkar. Lig 1.si bu sırada dinlenir.
- Final: lig 1.si – playoff galibi (15 dk).
- Galibiyet 3, beraberlik 1 puan. Eşitlikte: averaj → atılan gol → ikili maçlar → penaltı / yazı-tura.
- Eleme maçları berabere biterse penaltı sonucu girilir.

Toplam ≈ 1 sa 52 dk. Süre yetmezse playoff tek tıkla kaldırılabilir; final o zaman lig 1.si – 2.si olur (≈ 1 sa 40 dk).
Devre sayısı, maç süreleri, değişim ve ara süreleri *Kurulum* sekmesinden değiştirilebilir.

## Kısayollar

- `Boşluk`: canlı maçın saatini duraklat / devam ettir
- `Esc`: golü atan panelini, açık menüleri ya da yayın ekranındaki fikstürü kapat

## Yazı tipleri

Barlow ve Barlow Condensed `fonts/` klasöründe (Latin + Latin-ext, woff2); internet gerekmez.
Lisans: SIL Open Font License 1.1 (`fonts/OFL.txt`).

## Testler

```sh
node --test tests/tournament.test.js
```

## Yayınlama (isteğe bağlı)

Statik site olduğu için Cloudflare Pages'e klasör olduğu gibi yüklenebilir
(dashboard'dan sürükle-bırak ya da `npx wrangler pages deploy .`).
Not: Veriler her cihazın kendi tarayıcısında tutulur; yayınlanan sürümde herkes kendi kopyasını görür.
Herkesin aynı canlı skoru görmesi için ortak bir veri katmanı eklemek gerekir.
