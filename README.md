# Müşteri Hesap Takibi

Ev eşyası mağazası için müşteri hesap kartı, taksit ve tahsilat uygulaması. Arayüz Next.js; kimlik doğrulama ve PostgreSQL veritabanı Supabase üzerindedir.

## Özellikler

- Müşteri, kefil, fatura, kimlik ve vergi alanları; bir satışta birden fazla ürün
- Peşinat sonrası kalan bedelin kuruş kaybetmeden aylık taksitlere bölünmesi
- Kısmi ödeme, ödeme geri alma gerekçesi, kalan borç ve gecikme hesabı
- Tahsilat grafiği, yaklaşan ve geciken ödeme listeleri
- Müşteriye verilecek yazdırılabilir ödeme planı
- İzin verilen cihazlara, vade 3 gün kala ve gecikmede Web Push bildirimi
- Stok modülü için ayrı `sale_items` kayıtları; faz 2'de ürün/stok tabloları eklenebilir

## Yerel kurulum

1. `npm install`
2. [Supabase](https://supabase.com/dashboard) üzerinde bir proje oluşturun.
3. SQL Editor içinde [`supabase/migrations/20261026000000_initial.sql`](supabase/migrations/20261026000000_initial.sql) dosyasını çalıştırın. SQL, tabloları, erişim kurallarını ve atomik satış/ödeme fonksiyonlarını oluşturur.
4. Supabase Auth ayarlarında herkese açık kullanıcı kaydını kapatın. Auth > Users bölümünden baba ve gerekiyorsa oğul için e-posta/şifre hesabı oluşturun.
5. Oluşturulan hesapları `staff` tablosuna ekleyin. Her hesap için e-postayı değiştirerek SQL Editor'da çalıştırın:

   ```sql
   insert into public.staff (user_id, display_name)
   select id, 'Mağaza Yetkilisi'
   from auth.users
   where email = 'kullanici@example.com';
   ```

6. `.env.example` dosyasını `.env.local` olarak kopyalayın. Supabase Project Settings > API bölümündeki URL, **publishable key** ve yalnızca sunucuda kullanılacak **secret key** değerlerini girin. Secret key'i hiçbir zaman tarayıcı koduna veya Git'e koymayın.
7. `npm run dev` ile uygulamayı açın. `.env.local` yoksa kurulum sayfası gösterilir.

## Telefon bildirimleri

Web Push ayrıca ücretli SMS/WhatsApp API'si gerektirmez. `npx web-push generate-vapid-keys` komutuyla VAPID anahtarları oluşturup `.env.local` içindeki `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ve `VAPID_SUBJECT` değerlerini doldurun. `CRON_SECRET` için uzun, rastgele bir metin belirleyin.

Uygulama HTTPS üzerinden yayımlandıktan sonra `supabase/reminders_cron.example.sql` dosyasındaki URL ve secret yer tutucularını değiştirip SQL Editor'da çalıştırın. Bu görev her gün Türkiye saatiyle 09.00'da `/api/cron/reminders` uç noktasını çağırır. Telefon bildirim izni vermelidir; iPhone'da web uygulaması ana ekrana eklenmelidir. Bildirim gelmese bile uyarılar dashboard'da görünür.

## Kontrol

```bash
npm test
npm run lint
npm run build
```

## Veri güvenliği ve yedekleme

Veriler yalnızca `staff` tablosunda aktif olan oturumlara açılır. Taksit ve ödeme tablolarına doğrudan yazma izni yoktur; satış ve tahsilat veritabanı fonksiyonlarıyla tek işlem olarak kaydedilir. Peşinat ve taksit ödemeleri ayrı hareketlerdir. Geri alınan ödemeler silinmez, gerekçesiyle saklanır.

Supabase ücretsiz planda günlük otomatik yedeğe güvenmeyin. Canlı kullanım için düzenli dışa aktarım ve ayrı yerde saklama planı kurun; ücretsiz proje az kullanımda duraklayabilir. Müşteri kayıtları tutulmadan önce bu operasyonel adımı tamamlayın.
