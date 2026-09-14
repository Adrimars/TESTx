# Gizlilik Politikası (TASLAK - HUKUKİ ONAYDAN GEÇMEMİŞTİR)

> Bu belge, `apps/mobile/src/content/aydinlatmaMetni.ts` içindeki KVKK Madde 10
> aydınlatma metniyle **aynı amaca hizmet etmez ve onun yerine geçmez**.
> Aydınlatma metni yalnızca KVKK Madde 10 kapsamındaki dar bilgilendirme
> yükümlülüğünü karşılar; bu belge ise Apple App Store / Google Play'in ayrıca
> zorunlu tuttuğu, herkese açık bir URL üzerinden erişilebilir olması gereken
> genel gizlilik politikasıdır (bkz. `appstore-playstore-compliance-research.md`
> §8). İki belge birbirinden bağımsız güncellenebilir ama tutarlı olmalıdır.
>
> `privacy-policy` dosyasındaki PlantApp/ScaleUp metni yapısal referans olarak
> kullanılmış, TESTx'in gerçek veri modeline (`schema.prisma`) ve
> `kvkk-compliance-research.md`'deki hukuki iskelete göre yeniden yazılmıştır.
> PlantApp metnindeki TESTx'e uymayan bölümler (yüz verisi, IDFA/IDVF,
> Microsoft Clarity, reklam çerezleri, in-app purchase, CCPA/CalOPPA, 13 yaş
> sınırı, "kullanarak kabul etmiş sayılırsınız" ibaresi) bilinçli olarak
> çıkarılmıştır — bkz. bu belgenin sonundaki not.
>
> **Doldurulması gereken açık maddeler ([TASLAK] ile işaretli):** veri
> sorumlusunun ticari unvanı/adresi, başvuru/iletişim kanalı, barındırma
> (hosting) sağlayıcısının kimliği, kesin saklama süreleri ve Google'a yurt
> dışı aktarımın KVKK Madde 9 dayanağı. Bu belge, bu maddeler doldurulup bir
> KVKK/kişisel veri konusunda deneyimli avukat tarafından onaylanmadan yayına
> alınmamalıdır.

## 1. Kapsam

Bu Gizlilik Politikası, TESTx mobil uygulamasını ve TESTx'in yönetici
(`apps/admin`) ile değerlendirme (`apps/evaluator`) web arayüzlerini
(birlikte "Hizmet") kullanan tüm kullanıcılar için geçerlidir.

## 2. Veri Sorumlusu

**[TASLAK - şirket bilgisi bekleniyor]** [ŞİRKET UNVANI] ("TESTx", "Şirket",
"biz"), [ADRES] adresinde yerleşik olup, 6698 sayılı Kişisel Verilerin
Korunması Kanunu ("KVKK") uyarınca kişisel verilerinizin işlenmesi
bakımından veri sorumlusu sıfatıyla hareket etmektedir.

## 3. Tanımlar

- **Kişisel Veri:** Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin
  her türlü bilgi.
- **Hizmet:** TESTx mobil uygulaması ile yönetici/değerlendirme web
  arayüzleri.
- **Değerlendirici:** TESTx üzerinden test/anket yanıtlayan kullanıcı.
- **Çerez (Cookie):** Web tarayıcınız tarafından saklanan, oturumunuzu
  yönetmemize yarayan küçük veri parçası.

## 4. Topladığımız Kişisel Veriler

**Hesap Bilgileri:** e-posta adresiniz ve (Google ile kayıt olmayı tercih
etmeniz halinde) Google hesap kimliğiniz. Şifreniz tarafımızda geri
çözülemeyecek şekilde (hash'lenerek) saklanır.

**Değerlendirici Profili:** yaşınız, cinsiyetiniz, ülkeniz, şehriniz, ana
diliniz, yabancı dilleriniz, mesleğiniz, eğitim durumunuz, yapay zeka
kullanım alanlarınız/deneyiminiz/kullanım sıklığınız ve ilgi alanlarınız.

**Profil Görseli Tercihi:** uygulama içinde sunulan hazır avatarlardan
seçtiğiniz simge. Bir fotoğraf yüklemesi söz konusu değildir; yüz veya diğer
biyometrik veri işlenmez.

**Test Yanıtları:** katıldığınız testlere verdiğiniz yanıtlar ve
değerlendirmeler, bunlara karşılık kazandığınız puan bakiyesi.

**Cihaz Bilgisi:** kayıt sırasında kullandığınız cihaza ilişkin bir
tanımlayıcı; bu tanımlayıcı yalnızca aynı cihazdan birden fazla hesap
açılıp açılmadığının tespiti için kullanılır.

**Oturum/Çerez Bilgisi (yalnızca web arayüzleri):** `apps/admin` ve
`apps/evaluator` web arayüzlerinde, oturumunuzu güvenli biçimde sürdürmek
için zorunlu (httpOnly, tarafımızca reklam veya izleme amacıyla
kullanılmayan) oturum çerezleri kullanılır. Bu çerezler devre dışı
bırakılırsa oturum açık tutulamaz. TESTx şu anda reklam, izleme veya
analitik amaçlı üçüncü taraf çerezi/SDK'sı **kullanmamaktadır**; bu
değişirse bu bölüm güncellenecek ve bildirim yapılacaktır.

**İşlem Güvenliği Bilgileri:** hesap oluşturma/güncelleme zaman damgaları,
aydınlatma metnini okuduğunuza dair zaman damgası, sunucu erişim
kayıtları (IP adresi, istek zamanı) — güvenlik ve kötüye kullanımın
önlenmesi amacıyla sınırlı süreyle tutulur.

Özel nitelikli kişisel veri (KVKK m.6 — ırk, sağlık, biyometrik veri vb.)
toplanmamakta ve işlenmemektedir.

## 5. Verilerinizi Neden İşliyoruz

- Hesabınızın oluşturulması, kimlik doğrulaması ve Hizmete erişiminizin
  sağlanması,
- Değerlendirici profilinize uygun testlerle eşleştirilmeniz,
- Puan/ödül bakiyenizin yönetimi,
- Aynı cihazdan birden fazla hesap açılmasının tespiti ve kötüye
  kullanımın önlenmesi,
- Hizmetin güvenliğinin ve sürekliliğinin sağlanması,
- Yürürlükteki mevzuattan doğan yükümlülüklerin yerine getirilmesi ve
  yetkili mercilerin taleplerinin karşılanması.

Bu işlemler esas olarak KVKK m.5/2(c) (sözleşmenin kurulması/ifası) ve
m.5/2(f) (meşru menfaat) hukuki sebeplerine dayanır; açık rızanıza
dayanan bir işleme faaliyeti bulunmamaktadır. (Bu durum, Hizmetin
kapsamı değiştikçe — örn. pazarlama iletişimi eklenirse — güncellenir ve
o işlem için ayrı, isteğe bağlı bir açık rıza alınır; bkz. son bölümdeki not.)

## 6. Verilerinizi Kimlerle Paylaşıyoruz

**Yurt içi:** [TASLAK] barındırma (hosting)/altyapı hizmeti aldığımız
tedarikçi(ler) ile, yalnızca Hizmetin çalıştırılması amacıyla sınırlı
olarak; yürürlükteki mevzuat gereği talep eden yetkili kamu kurum ve
kuruluşlarıyla.

**Yurt dışı (Google):** Google ile giriş yapmayı tercih etmeniz halinde,
kimlik doğrulama sürecinde Google LLC tarafından sağlanan altyapı
kullanılır ve bu kapsamda verileriniz yurt dışındaki sunuculara
aktarılabilir. [TASLAK] Bu aktarımın KVKK m.9 (7499 sayılı Kanun ile
değişik) kapsamında dayanacağı somut mekanizma hukuki değerlendirme
tamamlandıktan sonra netleştirilecek ve bu bölüm buna göre
güncellenecektir.

Kişisel verilerinizi hiçbir üçüncü tarafa **satmıyoruz** ve reklam amacıyla
paylaşmıyoruz.

## 7. Saklama Süresi

[TASLAK] Kişisel verileriniz, hesabınız aktif olduğu sürece ve yukarıda
belirtilen amaçların gerektirdiği süre boyunca işlenir. Hesabınızı
uygulama içinden sildiğinizde verileriniz, mevzuattan doğan saklama
yükümlülüklerimiz saklı kalmak kaydıyla, ilgili mevzuatta öngörülen
süreler içinde silinir, yok edilir veya anonim hale getirilir. Kesin
saklama süreleri hukuki değerlendirme sonrasında netleştirilecektir.

## 8. Hesap Silme

Hesabınızı uygulama içindeki profil ekranından dilediğiniz zaman
silebilirsiniz. Uygulamayı cihazınızdan kaldırmış olsanız bile silme
talebinde bulunabilmeniz için [TASLAK: web üzerinden erişilebilen bir
hesap silme talep yolu/adresi — Apple/Google mağaza kuralları bunu ayrıca
zorunlu kılar, bkz. `appstore-playstore-compliance-research.md` §3]
sağlanacaktır.

## 9. Veri Güvenliği

Kişisel verilerinizin güvenliğini sağlamak için makul teknik ve idari
tedbirler alıyoruz (parolaların hash'lenmesi, oturum kimlik doğrulamasının
httpOnly çerezler/Bearer token ile yapılması gibi). [TASLAK] Barındırma
altyapısına özgü ek güvenlik tedbirleri (yedekleme, şifreleme, erişim
kontrolü vb.) altyapı sağlayıcısı netleştikten sonra bu bölüme
eklenecektir. Buradaki hiçbir ifade, doğrulanmamış bir güvenlik iddiası
olarak okunmamalıdır.

## 10. Çocukların Gizliliği

TESTx yalnızca **18 yaş ve üzeri** kullanıcılara yöneliktir; kayıt
sırasında yaşınızı 18 veya üzeri olarak beyan etmeniz istenir. 18 yaşından
küçük olduğunu öğrendiğimiz bir hesabı kapatırız.

## 11. KVKK m.11 Uyarınca Haklarınız

Bize başvurarak: kişisel verinizin işlenip işlenmediğini öğrenme;
işlenmişse buna ilişkin bilgi talep etme; işlenme amacını ve amacına
uygun kullanılıp kullanılmadığını öğrenme; yurt içinde/yurt dışında
aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse
düzeltilmesini isteme; KVKK m.7 kapsamında silinmesini veya yok
edilmesini isteme; düzeltme/silme işlemlerinin, verilerin aktarıldığı
üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle
analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz
etme; kanuna aykırı işlenme sebebiyle zarara uğramanız halinde zararın
giderilmesini talep etme haklarına sahipsiniz.

## 12. Başvuru Yöntemi

[TASLAK - şirket bilgisi bekleniyor] Yukarıdaki haklarınıza ilişkin
taleplerinizi [BAŞVURU KANALI — örn. kvkk@[şirket-domaini]] adresine veya
veri sorumlusunun 2. bölümde belirtilen adresine yazılı olarak
iletebilirsiniz. Taleplerinize KVKK'da öngörülen süreler içinde yanıt
verilir.

## 13. Bu Politikadaki Değişiklikler

Hizmetimizde veya bu Politikada yapılacak değişiklikler bu sayfada
yayımlanır. Önemli değişikliklerde, uygulama içinden veya kayıtlı
e-posta adresiniz üzerinden ayrıca bilgilendirilirsiniz. Bu Politikanın
kabulü, aydınlatma metninde ayrıca belirtilen açık rıza gerektiren bir
işlemin yerine geçmez; yani bu Politikayı okumuş olmanız, ayrı bir açık
rıza gerektiren bir işleme otomatik olarak rıza gösterdiğiniz anlamına
gelmez.

## 14. Uygulanacak Hukuk

Bu Politika Türkiye Cumhuriyeti hukukuna tabidir.

---

**PlantApp metninden bilinçli olarak çıkarılan bölümler** (TESTx'in veri
modeliyle uyuşmadığı veya hukuki risk taşıdığı için): yüz/biyometrik veri
işleme, reklam kimlikleri (IDFA/IDVF), Microsoft Clarity ve benzeri
davranışsal analiz araçları, reklam çerezleri, in-app purchase/finans
verisi işleme, CCPA/CalOPPA ve GDPR'a özgü bölümler (TESTx şu an ABD/AB
kullanıcı kitlesine yönelik değildir — hedef kitle genişlerse bu bölüm
yeniden değerlendirilmelidir), "13 yaş altı" ibaresi (TESTx'in kendi 18+
kuralıyla çelişir), ve "uygulamayı kullanarak bu Politikayı kabul etmiş
sayılırsınız" ifadesi (KVKK Kurulunun serbest irade/ayrıştırma ilkesiyle
çelişir — bkz. `kvkk-compliance-research.md` Bölüm 8).
