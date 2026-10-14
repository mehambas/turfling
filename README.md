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
node --test tests/*.test.js
```

## Yayınlama (isteğe bağlı)

Statik site olduğu için Cloudflare Pages'e klasör olduğu gibi yüklenebilir
(dashboard'dan sürükle-bırak ya da `npx wrangler pages deploy .`).
Not: Veriler her cihazın kendi tarayıcısında tutulur; yayınlanan sürümde herkes kendi kopyasını görür.
Herkesin aynı canlı skoru görmesi için ortak bir veri katmanı eklemek gerekir.

## Gol bildirimi

İzleyici sayfasındaki zil, o yayının gollerini, biten maçların sonucunu ve şampiyonu telefona bildirim olarak gönderir; bildirim telefonun kendi titreşimi ve sesiyle gelir.
iPhone'da yalnız ana ekrana eklenmiş uygulamada çalışır (iOS 16.4+); Safari'de zile dokununca bu anlatılır.

Yönetim ekranında *Kurulum → Canlı yayın → Süre bildirimi* açılırsa maçın son dakikasında ve süre bitince o cihaza da bildirim gelir, telefon kilitliyken de.
Zamanı sunucu tutar; duraklatma ve maçı bitirme bildirimi kendiliğinden kaydırır ya da iptal eder.
Yönetim ekranı açıkken Android'de bildirim gelmez, uyarıyı sayfa kendisi verir (ses ve titreşim); iPhone'da bildirim her zaman gelir.

Worker bir kez VAPID anahtarı ister; anahtar yoksa zil ve süre bildirimi görünmez:

```sh
cd worker
node vapid-key.js | npx wrangler secret put VAPID_KEY
```

Yerelde (`npm run dev`) denemek için: `printf 'VAPID_KEY=%s\n' "$(node vapid-key.js)" > .dev.vars`

Canlı turnuvaya dokunmadan denemek için aynı kod ayrı bir Worker olarak yayınlanabilir.
Adresi, turnuvaları ve tarayıcıdaki kayıtları canlı sürümden tamamen ayrıdır:

```sh
cd worker
npx wrangler deploy --name hali-saha-test
node vapid-key.js | npx wrangler secret put VAPID_KEY --name hali-saha-test
```
