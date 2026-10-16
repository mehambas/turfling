# Halı Saha Turnuvası

3 takım için turnuva takip ekranı: oyuncu havuzu, torbalı kura, canlı skor ve süre, puan durumu, fikstür, gol krallığı, turnuva arşivi ve kişisel istatistikler.
Build adımı yok; düz HTML/CSS/JS.

## Çalıştırma

`index.html` dosyasına çift tıklamak yeterli. İnternet gerekmez; veriler tarayıcıda (localStorage) saklanır.
Sayfa kapanıp açılsa da kaldığı yerden devam eder. Turnuva öncesinde ve sonrasında *Kurulum → Yedek → İndir* önerilir.

## Oyuncu havuzu ve yeni turnuva

Oyuncuların kimlikleri kalıcıdır; takım üyeliği her turnuvaya aittir. *Kurulum → Oyuncu havuzundan seç* bölümünden o gün katılacakları ekleyin, yeni kişileri isim alanından oluşturun. Katılmayan kişiyi listeden çıkarmak havuzu ve geçmişini silmez. Aynı isimde farklı kişiler ayrı kaydedilebilir; ayırt etmek için soyadı veya lakap eklenebilir. Yanlışlıkla iki kez oluşturulan kişi, profilindeki *Mükerrer kaydı birleştir* ile tek kimliğe taşınabilir. Önce yedek indirilir; aynı turnuvada farklı takımlarda veya aynı maçta rakip görünen kayıtlar birleştirilmez.

Katılımcıları seçtikten sonra torbaları belirleyip kurayı çekin. **K** işareti kaleciyi belirtir. Kura, torba ve kişi sayısı dengesini koruyan 301 aday arasından önce kalecileri daha dengeli dağıtan, sonra geçmişte aynı takımda bulunma tekrarını azaltan seçeneği alır. Yakın turnuvalara daha fazla ağırlık verir; gol ve galibiyet sayısını otomatik oyuncu gücü saymaz. Bu bir aday aramasıdır; matematiksel olarak en iyi dağılım garantisi vermez.

Turnuva tamamlanınca *Geçmiş → Arşivle* kullanılabilir. *Yeni turnuva* da tamamlanan turnuvayı arşivler, mevcut verilerin JSON yedeğini indirmeyi başlatır ve boş katılımcı listesi açar. Format ayarları korunur; tarih ve saat temizlenir. Bitmemiş turnuvanın üzerine yeni turnuva açılmaz. Arşivlenmiş turnuvanın sonuçları sıfırlanamaz.

## Maç kadroları ve geçmiş

Maç başlatılırken kadro otomatik saklanır; ayrıca onay gerekmez. Fikstürdeki veya canlı maçtaki *Kadro* düğmesiyle sadece o maçın istisnaları değiştirilebilir. Oyuncu maçın bir bölümünde bile oynadıysa kadroda tutulur. Bu sürüm süre/dakika bazında oyuncu değişikliği ve aynı maçta iki tarafta oynama takibi yapmaz.

*Geçmiş* sekmesinde turnuvalar, toplam maç ve goller, oyuncuların maç/G/B/M/gol sayıları bulunur. Oyuncuya dokununca birlikte ve rakip olarak oynadığı kişiler, karşılıklı sonuçlar ve katıldığı turnuvalar görünür. İstatistikler arşivlerle mevcut turnuvanın biten maçlarından hesaplanır; aynı turnuva iki kez sayılmaz. Katılım sayısı turnuvanın katılımcı listesini, maç sayısı maç kadrosunu esas alır. G/B/M normal süre sonucudur; penaltıyla kazanılan maçlar profilde ayrıca gösterilir. Seri penaltılar gol toplamına girmez; kendi kalesine ve sahibi bilinmeyen goller ayrı tutulur.

Arşivdeki *Kadro / düzeltme* ile gol, gol sahibi, penaltı sonucu ve maç kadrosu düzenlenir. *Kaydet* uygulanana kadar kayıt değişmez. Oynanmış bir eleme eşleşmesini geçersiz kılan skor düzeltmesi reddedilir. Eski sürümün yedeği kimlik ve goller korunarak dönüştürülür; maç kadroları turnuva kadrosundan alınır ve varsayım olarak işaretlenir. İlk yerel sürümün ham kaydı, alan varsa `halisaha-turnuva-ilk-yedek` anahtarında da korunur.

Yedek indirme/yükleme oyuncu havuzunu ve tüm arşivi kapsar. Yükleme mevcut koleksiyonun yerine geçer; değiştirmeden önce mevcut koleksiyonun yedeği indirilmeye çalışılır.

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
Final de kaldırılabilir (*Kurulum → Süreler → Final* ya da fikstürde *Kaldır*); o zaman playoff da oynanmaz ve lig bitince puan durumunda 1. olan takım şampiyon olur (≈ 1 sa 22 dk).
Birinciler her şeyiyle eşitse şampiyon penaltı ya da yazı-tura ile belirlenir.
Devre sayısı, maç süreleri, değişim ve ara süreleri *Kurulum* sekmesinden değiştirilebilir.

## Maç özeti

Biten bir maçın skoruna dokununca özeti açılır: kim kaç gol attı, hangi dakikada, gol sırasıyla ara skorlar, penaltılar ve sonuç.
Yönetim ekranında Fikstür'den, izleyici sayfasında Fikstür sekmesinden, takım sayfasından ve "Son maç" kartından açılır; TV'de Fikstür penceresinden.

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
Yalnız statik barındırmada veriler her cihazın tarayıcısında tutulur. Ortak canlı yayın ve sunucuda kalıcı kayıt için `worker/` içindeki Worker kullanılır. *Kurulum → Canlı yayın → Yayını başlat* ile mevcut koleksiyon sunucuya gönderilir; aynı yönetici bağlantısından başka cihazda açılabilir. Yeni turnuvalar aynı bağlantı altında devam eder. Bağlantı yokken değişiklikler tarayıcıda kalır; bağlantı gelince mevcut sürüm/tek yönetici kurallarıyla senkronize edilir.

Sunucu mevcut turnuvayı ve arşivi ayrı depolama kayıtlarında tutar. Kimliksiz GET ve WebSocket yalnız mevcut turnuvayı döndürür; oyuncu havuzu ve arşiv yönetici anahtarı isteyen `/api/t/:id/admin` üzerinden alınır. Yönetici, kütüphane sürümü değişmedikçe canlı yayın mesajlarını elindeki kütüphaneyle birleştirir.

Skor/saat PUT istekleri kütüphaneyi içermez. Oyuncu havuzu değiştiğinde havuz; arşiv değiştiğinde yalnız eklenen/düzeltilen kayıtlar ve silinen kayıt kimlikleri `library` alanında gönderilir. Büyük ilk aktarım ve yedek yüklemesi yaklaşık 512 KiB kütüphane gruplarıyla ilerler; tamamlanana kadar bekleyen değişiklik göstergesi açık kalır. Yeniden açılan cihaz önce sunucudaki kütüphaneyi öğrenir. Arşiv büyüklüğü sıradan canlı güncellemenin boyutunu artırmaz.

Kütüphane yalnız değiştiğinde yazılır; tekrar gelen aynı içerik yeniden yazılmaz. Depolama parçaları ve revizyon aynı işlemde kaydedilir. İstek sınırı 1 MiB, mevcut turnuva sınırı 64 KiB'dır. Eski toplu arşiv protokolüyle yazmaya çalışan istemciden sayfayı yenilemesi istenir; arşiv böylece yanlışlıkla silinmez. `.wrangler` ve `docs` statik yayına dahil edilmez. Herkese açılmadan önceki erişim/saklama işleri `docs/yayin-oncesi.md` içinde takip edilir.

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
