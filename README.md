# Müşteri Hesap Takibi

Ev eşyası mağazası için müşteri hesap kartı, taksit ve tahsilat uygulaması. Arayüz Next.js; kimlik doğrulama ve PostgreSQL veritabanı Supabase üzerindedir.

## Özellikler

- Müşteri, kefil, fatura, kimlik ve vergi alanları; bir satışta birden fazla ürün
- Peşinat sonrası kalan bedelin kuruş kaybetmeden aylık taksitlere bölünmesi
- Kısmi ödeme, ödeme geri alma gerekçesi, kalan borç ve gecikme hesabı
- Tahsilat grafiği, yaklaşan ve geciken ödeme listeleri
- Müşteriye verilecek yazdırılabilir ödeme planı
- İzin verilen cihazlara, vade 3 gün kala ve gecikmede Web Push bildirimi
- Sol menüden müşteri listesi, müşteri bilgilerini güncelleme ve geçmiş satışları koruyarak listeden kaldırma
- Ürün kartları, başlangıç stoku, stok giriş/çıkışı ve hareket geçmişi; katalog ürünü satıldığında otomatik stok düşümü

## Yerel kurulum

1. `npm install`
2. [Supabase](https://supabase.com/dashboard) üzerinde bir proje oluşturun.
3. SQL Editor içinde önce [`supabase/migrations/20261026000000_initial.sql`](supabase/migrations/20261026000000_initial.sql), ardından [`supabase/migrations/20261030000000_inventory_customers.sql`](supabase/migrations/20261030000000_inventory_customers.sql) dosyasını çalıştırın. İkinci dosya mevcut projede yalnızca yeni stok tablolarını, müşteri arşivleme alanını ve ilgili fonksiyonları ekler.
4. Supabase Auth ayarlarında herkese açık kullanıcı kaydını kapatın. Auth > Users bölümünden baba ve gerekiyorsa oğul için e-posta/şifre hesabı oluşturun.
5. Oluşturulan hesapları `staff` tablosuna ekleyin. Her hesap için e-postayı değiştirerek SQL Editor'da çalıştırın:

   ```sql
   insert into public.staff (user_id, display_name)
   select id, 'Mağaza Yetkilisi'
   from auth.users
   where email = 'kullanici@example.com';
   ```

6. `.env.example` dosyasını `.env.local` olarak kopyalayın. Supabase Project Settings > API bölümündeki URL ve **publishable key** değerlerini girin. VAPID public key yalnızca bildirim aboneliği için kullanılır; özel anahtar Supabase Vault'ta tutulur.
7. `npm run dev` ile uygulamayı açın. `.env.local` yoksa kurulum sayfası gösterilir.

## Cloudflare Workers üzerinde yayınlama

Bu uygulama sunucuda oturum kontrolü, Server Actions ve API yolları kullandığı için
Cloudflare **Workers** üzerinde `vinext` ile çalışır. Statik Pages dağıtımı uygun değildir.
Git bağlantısı daha sonra kurulursa kaynak dalı GitHub'daki `main` olmalıdır.

İlk canlı yayın yerel terminalden `npm run deploy:vinext` ile yapıldı.
**GitHub otomatik dağıtımı henüz bağlı değil:** `git push` tek başına canlı sürümü
güncellemez. Sonraki dağıtımlarda Cloudflare hesabındaki sınırlı yetkili API
anahtarı `CLOUDFLARE_API_TOKEN` ortam değişkeni olarak sağlanmalıdır; anahtar
değeri bu depoda veya yerel `.env` dosyalarında tutulmaz.

Sınırlı yetkili anahtarı dosyaya kaydetmeden dağıtmak için `bash scripts/deploy-cloudflare.sh`
çalıştırın. Komut anahtarı görünmeden ister ve yalnızca o dağıtım işlemi için kullanır.

- Node sürümü `.node-version` dosyasındaki **24.22.1** olmalı.
- Var olan canlı Supabase projesinde yeni migration uygulanmadan yeni Worker sürümünü yayımlamayın.
- Workers Builds **Build command**: `npm run build:vinext`
- Workers Builds **Deploy command**: `npm run deploy:vinext`
- İlk kurulumda önizleme dağıtımlarını kapalı tutun; önizlemeler aynı canlı Supabase
  projesine bağlanır.
- Supabase URL ve publishable key, herkese açık değerler olarak
  `deployment/public-env.ts` dosyasında tanımlıdır. Secret key veya veritabanı
  şifresini GitHub'a koymayın.
- Telefon bildirimi için herkese açık VAPID anahtarı da
  `deployment/public-env.ts` içinde bulunur.

Yerel Worker önizlemesi için `npm run build:vinext` ve ardından
`npm run start:vinext` çalıştırın. Ücretsiz Workers planında istek başına CPU
sınırı vardır; canlı yayından sonra giriş, dashboard, yeni satış ve kısmi ödeme
akışlarını gerçek adreste kontrol edin.

## Telefon bildirimleri

Web Push için ücretli SMS/WhatsApp API'si gerekmez. Gönderim işlevi
`supabase/functions/daily-push-reminders` içinde çalışır. VAPID özel anahtarı ve
günlük görev tokeni Supabase Vault'ta tutulur; Cloudflare'a gizli Supabase anahtarı
verilmez. `20261030152706_daily_push_reminders.sql` migration'ı her gün Türkiye
saatiyle 09.00'da işlevi çağırır.

Canlı Supabase projesinde işlev, Vault anahtarları ve günlük görev kurulmuştur.
Cloudflare uygulaması yeni sürümle dağıtıldıktan sonra kullanıcı Android Chrome'da
uygulamaya giriş yapıp **Telefon bildirimi → Aç** düğmesine basmalı ve tarayıcı iznini
onaylamalıdır. Telefon izin vermeden bildirim gönderilemez. Bildirim gelmese bile
yaklaşan ödeme uyarıları dashboard'da görünür.

## Kontrol

```bash
npm test
npm run lint
npm run build
```

## Veri güvenliği ve yedekleme

Veriler yalnızca `staff` tablosunda aktif olan oturumlara açılır. Taksit ve ödeme tablolarına doğrudan yazma izni yoktur; satış ve tahsilat veritabanı fonksiyonlarıyla tek işlem olarak kaydedilir. Peşinat ve taksit ödemeleri ayrı hareketlerdir. Geri alınan ödemeler silinmez, gerekçesiyle saklanır. Müşteri silme işlemi kayıtları arşivler; satışlar, ödemeler ve alacaklar korunur. Stok hareketleri de silinmeyen bir geçmiş olarak tutulur.

Supabase ücretsiz planda günlük otomatik yedeğe güvenmeyin. Canlı kullanım için düzenli dışa aktarım ve ayrı yerde saklama planı kurun; ücretsiz proje az kullanımda duraklayabilir. Müşteri kayıtları tutulmadan önce bu operasyonel adımı tamamlayın.
