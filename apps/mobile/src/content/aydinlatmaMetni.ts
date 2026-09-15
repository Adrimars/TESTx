/**
 * DRAFT TEXT - NOT LEGALLY APPROVED.
 *
 * Drafted from the skeleton in kvkk-compliance-research.md and the actual
 * fields in schema.prisma (User, EvaluatorProfile, TestResponse). Two things
 * are still open and marked inline with [TASLAK]:
 *
 *  1. Veri Sorumlusu identity (company legal name/address/contact) - the
 *     entity was not yet decided as of this draft. Fill in "Veri Sorumlusu"
 *     and "Basvuru Yontemi" the moment it is.
 *  2. The KVKK Article 9 mechanism for the Google cross-border transfer -
 *     kvkk-compliance-research.md Section 4 deliberately leaves this to
 *     counsel (acik riza alone is likely NOT sufficient for a routine/
 *     continuous dependency like OAuth sign-in). Do not resolve this here.
 *
 * This must still be signed off by a KVKK-experienced lawyer before it ships
 * to production, even after both items above are filled in. The engineering
 * flow around it is complete and does not need to change when the wording is
 * replaced; only this file does.
 *
 * Required by KVKK Article 10, and it must disclose the Google infrastructure
 * involvement explicitly.
 */
export const AYDINLATMA_METNI_IS_PLACEHOLDER = true;

export const AYDINLATMA_METNI_VERSION = "draft-1";

export const AYDINLATMA_METNI_TITLE = "Aydinlatma Metni";

export const AYDINLATMA_METNI_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "Veri Sorumlusu",
    body: "[TASLAK - sirket bilgisi bekleniyor] [SIRKET UNVANI] (\"TESTx\" veya \"Sirket\"), [ADRES] adresinde yerlesik olup, 6698 sayili Kisisel Verilerin Korunmasi Kanunu (\"KVKK\") uyarinca kisisel verilerinizin islenmesi bakimindan veri sorumlusu sifatiyla hareket etmektedir.",
  },
  {
    heading: "Islenen Kisisel Veriler",
    body: "Hesap Bilgileri: e-posta adresiniz ve (Google ile kayit olmayi tercih etmeniz halinde) Google hesap kimliginiz.\n\nDegerlendirici Profili: yasiniz, cinsiyetiniz, ulkeniz, sehriniz, ana diliniz, yabanci dilleriniz, mesleginiz, egitim durumunuz, yapay zeka kullanim alanlariniz/deneyiminiz/kullanim sikliginiz ve ilgi alanlariniz.\n\nProfil Gorseli Tercihi: uygulama icinde sunulan hazir avatarlardan sectiginiz simge. Bir fotograf yuklemesi soz konusu degildir; yuz veya diger biyometrik veri islenmez.\n\nTest Yanitlari: katildiginiz testlere verdiginiz yanitlar ve degerlendirmeler.\n\nCihaz Bilgisi: kayit sirasinda kullandiginiz cihaza iliskin bir tanimlayici; bu tanimlayici yalnizca ayni cihazdan birden fazla hesap acilip acilmadiginin tespiti icin kullanilir.\n\nIslem Guvenligi Bilgileri: hesap olusturma/guncelleme zaman damgalari ile bu aydinlatma metnini okudugunuza dair zaman damgasi.\n\nOzel nitelikli kisisel veri (KVKK m.6 - irk, saglik, biyometrik veri vb.) islenmemektedir.",
  },
  {
    heading: "Isleme Amaclari ve Hukuki Sebepleri",
    body: "Hesabinizin olusturulmasi ve kimlik dogrulamasinin yapilmasi; size uygun testlerin eslestirilmesi amaciyla degerlendirici profilinizin kullanilmasi; puan/odul bakiyenizin yonetimi; ayni cihazdan birden fazla hesap acilmasinin tespiti ve kotuye kullanimin onlenmesi; yururlukteki mevzuattan dogan yukumluluklerin yerine getirilmesi ve yetkili mercilerin taleplerinin karsilanmasi.\n\nBu islemler, KVKK m.5/2 uyarinca esas olarak (c) bir sozlesmenin kurulmasi veya ifasiyla dogrudan ilgili olmasi ve (f) veri sorumlusunun mesru menfaati (ozellikle kotuye kullanimin onlenmesi) hukuki sebeplerine dayanilarak, acik rizaniz aranmaksizin islenmektedir.",
  },
  {
    heading: "Kisisel Verilerin Toplanma Yontemi",
    body: "Kisisel verileriniz, mobil uygulama uzerinden elektronik ortamda ve otomatik yollarla; kayit formunu doldurmaniz, degerlendirici profilinizi olusturmaniz, testlere yanit vermeniz veya Google ile giris yapmayi tercih etmeniz halinde Google'in kimlik dogrulama servisi araciligiyla toplanmaktadir.",
  },
  {
    heading: "Kisisel Verilerin Aktarilmasi",
    body: "[TASLAK] Yurt ici: kisisel verileriniz, barindirma/altyapi hizmeti aldigimiz tedarikcilerimize ve yururlukteki mevzuat geregi yetkili kamu kurum ve kuruluslarina, hukuki yukumlulugumuzun yerine getirilmesi amaciyla aktarilabilir.\n\nYurt disi: Google ile giris yapmayi tercih etmeniz halinde, kimlik dogrulama surecinde Google LLC tarafindan saglanan altyapi kullanilir ve bu kapsamda verileriniz yurt disindaki sunuculara aktarilabilir. Bu aktarimin KVKK m.9 (7499 sayili Kanun ile degisik) kapsaminda dayanacagi somut mekanizma (ornegin Google'in standart sozlesme hukumleri) hukuki degerlendirme tamamlandiktan sonra netlestirilecek ve bu bolum buna gore guncellenecektir.",
  },
  {
    heading: "Saklama Suresi",
    body: "[TASLAK] Kisisel verileriniz, hesabiniz aktif oldugu surece ve yukarida belirtilen amaclarin gerektirdigi sure boyunca islenir. Hesabinizi uygulama icinden sildiginizde verileriniz, mevzuattan dogan saklama yukumluluklerimiz sakli kalmak kaydiyla, ilgili mevzuatta ongorulen sureler icinde silinir, yok edilir veya anonim hale getirilir. Kesin saklama sureleri hukuki degerlendirme sonrasinda netlestirilecektir.",
  },
  {
    heading: "KVKK m.11 Uyarinca Haklariniz",
    body: "KVKK'nin 11. maddesi uyarinca bize basvurarak: kisisel verinizin islenip islenmedigini ogrenme; islenmisse buna iliskin bilgi talep etme; islenme amacini ve amacina uygun kullanilip kullanilmadigini ogrenme; yurt icinde/yurt disinda aktarildigi ucuncu kisileri bilme; eksik veya yanlis islenmisse duzeltilmesini isteme; KVKK m.7 kapsaminda silinmesini veya yok edilmesini isteme; duzeltme/silme islemlerinin, verilerin aktarildigi ucuncu kisilere bildirilmesini isteme; munhasiran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya cikmasina itiraz etme; kanuna aykiri islenme sebebiyle zarara ugramaniz halinde zararin giderilmesini talep etme haklarina sahipsiniz. Bu haklara ek olarak, hesabinizi uygulama icinden diledeginiz zaman silebilirsiniz.",
  },
  {
    heading: "Basvuru Yontemi",
    body: "[TASLAK - sirket bilgisi bekleniyor] Yukaridaki haklariniza iliskin taleplerinizi [BASVURU KANALI - ornegin: kvkk@[sirket-domaini]] adresine veya veri sorumlusunun yukarida belirtilen adresine yazili olarak iletebilirsiniz.",
  },
];
