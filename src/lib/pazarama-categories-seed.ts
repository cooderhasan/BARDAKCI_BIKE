export interface PazaramaCategoryItem {
  id: string;
  name: string;
  parentId?: string | null;
}

export const DEFAULT_PAZARAMA_CATEGORIES: PazaramaCategoryItem[] = [
  // Bisiklet Kategorileri
  { id: "paz-cat-b1", name: "Bisiklet > Bisikletler" },
  { id: "paz-cat-b2", name: "Bisiklet > Dağ Bisikleti (MTB)" },
  { id: "paz-cat-b3", name: "Bisiklet > Şehir ve Tur Bisikleti" },
  { id: "paz-cat-b4", name: "Bisiklet > Yol / Yarış Bisikleti" },
  { id: "paz-cat-b5", name: "Bisiklet > Katlanabilir Bisiklet" },
  { id: "paz-cat-b6", name: "Bisiklet > Elektrikli Bisiklet (E-Bike)" },
  { id: "paz-cat-b7", name: "Bisiklet > Çocuk Bisikleti" },
  { id: "paz-cat-b8", name: "Bisiklet > Denge Bisikleti" },
  { id: "paz-cat-b9", name: "Bisiklet Aksesuar > Kask ve Koruyucular" },
  { id: "paz-cat-b10", name: "Bisiklet Aksesuar > Bisiklet Çantası ve Bagaj" },
  { id: "paz-cat-b11", name: "Bisiklet Aksesuar > Işık ve Aydınlatma" },
  { id: "paz-cat-b12", name: "Bisiklet Aksesuar > Kilit ve Güvenlik" },
  { id: "paz-cat-b13", name: "Bisiklet Aksesuar > Pompa ve Tamir Seti" },
  { id: "paz-cat-b14", name: "Bisiklet Aksesuar > Zil ve Korna" },
  { id: "paz-cat-b15", name: "Bisiklet Aksesuar > Suluk ve Suluk Kafesi" },
  { id: "paz-cat-b16", name: "Bisiklet Aksesuar > Çamurluk ve Ayaklık" },
  { id: "paz-cat-b17", name: "Bisiklet Yedek Parça > Fren ve Vites Sistemleri" },
  { id: "paz-cat-b18", name: "Bisiklet Yedek Parça > Pedal ve Pedal Kolları" },
  { id: "paz-cat-b19", name: "Bisiklet Yedek Parça > Jant, Lastik ve İç Lastik" },
  { id: "paz-cat-b20", name: "Bisiklet Yedek Parça > Sele ve Sele Borusu" },
  { id: "paz-cat-b21", name: "Bisiklet Yedek Parça > Gidon ve Gidon Boğazı" },
  { id: "paz-cat-b22", name: "Bisiklet Yedek Parça > Zincir ve Ruble" },
  { id: "paz-cat-b23", name: "Bisiklet Giyim > Bisiklet Eldiveni" },
  { id: "paz-cat-b24", name: "Bisiklet Giyim > Forma ve Tayt" },

  // Motosiklet Kategorileri
  { id: "paz-cat-m1", name: "Motosiklet > Motosiklet Aksesuar" },
  { id: "paz-cat-m2", name: "Motosiklet > Motosiklet Yedek Parça" },
  { id: "paz-cat-m3", name: "Motosiklet Ekipman > Kask ve Aksesuarları" },
  { id: "paz-cat-m4", name: "Motosiklet Ekipman > Motosiklet Montu" },
  { id: "paz-cat-m5", name: "Motosiklet Ekipman > Motosiklet Eldiveni" },
  { id: "paz-cat-m6", name: "Motosiklet Ekipman > Dizlik ve Koruma" },
  { id: "paz-cat-m7", name: "Motosiklet Aksesuar > Motosiklet Çantası ve Topcase" },
  { id: "paz-cat-m8", name: "Motosiklet Aksesuar > Branda ve Koruma Örtüsü" },
  { id: "paz-cat-m9", name: "Motosiklet Aksesuar > Telefon Tutucu ve Bağlantı" },
  { id: "paz-cat-m10", name: "Motosiklet Aksesuar > Modifiye Vidalar ve Bağlantı Elemanları" },
  { id: "paz-cat-m11", name: "Motosiklet Aksesuar > Ayna ve Aydınlatma" },
  { id: "paz-cat-m12", name: "Motosiklet Yedek Parça > Fren Balatası ve Disk" },
  { id: "paz-cat-m13", name: "Motosiklet Yedek Parça > Akü ve Elektrik" },
  { id: "paz-cat-m14", name: "Motosiklet Yedek Parça > Filtre ve Yağlar" },
  { id: "paz-cat-m15", name: "Motosiklet Yedek Parça > Debriyaj ve Varyatör" },
  { id: "paz-cat-m16", name: "Motosiklet Yedek Parça > Kayış ve Zincir" },

  // Spor & Outdoor
  { id: "paz-cat-s1", name: "Spor & Outdoor > Spor Ekipmanları" },
  { id: "paz-cat-s2", name: "Spor & Outdoor > Kamp ve Outdoor" },
  { id: "paz-cat-s3", name: "Spor & Outdoor > Fitness ve Kondisyon" },

  // Otomotiv & Sanayi
  { id: "paz-cat-o1", name: "Otomotiv > Oto Aksesuar" },
  { id: "paz-cat-o2", name: "Otomotiv > Oto Bakım ve Temizlik" },
  { id: "paz-cat-o3", name: "Otomotiv > Oto Yedek Parça" },

  // Giyim & Ayakkabı & Aksesuar
  { id: "paz-cat-g1", name: "Giyim & Aksesuar > Erkek Giyim" },
  { id: "paz-cat-g2", name: "Giyim & Aksesuar > Kadın Giyim" },
  { id: "paz-cat-g3", name: "Giyim & Aksesuar > Spor Giyim" },
];
