const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

// MongoDB'ye bağlan
mongoose.connect('mongodb://localhost:27017/solanagram', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err));

// Kullanıcı şeması ve modeli
const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  phone: String,
  password: String,
  balance: { type: Number, default: 0 },
  profileImage: String,
  profileDesc: { type: String, default: '' }
});
const User = mongoose.model('User', UserSchema);

// Post şeması ve modeli
const PostSchema = new mongoose.Schema({
  username: String,
  imageUrl: String,
  caption: String,
  createdAt: { type: Date, default: Date.now },
  archived: { type: Boolean, default: false },
  likes: [{ type: String }], // Beğenen kullanıcıların username'leri
  comments: [{
    username: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
});
const Post = mongoose.model('Post', PostSchema);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Statik dosyaları serve et
app.use(express.static(__dirname));

// Ana sayfa için route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Untitled-1.html'));
});

// Diğer sayfalar için route'lar
app.get('/giris.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'giris.html'));
});

app.get('/kaydol.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'kaydol.html'));
});

app.get('/profil.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'profil.html'));
});

app.get('/bakiye.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'bakiye.html'));
});

app.get('/arsiv.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'arsiv.html'));
});

app.get('/paylasim_onay.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'paylasim_onay.html'));
});

app.get('/post.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'post.html'));
});

app.get('/akis.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'akis.html'));
});

// Kayıt olma endpoint'i
app.post('/api/register', async (req, res) => {
  const { username, email, phone, password } = req.body;
  const existsUsername = await User.findOne({ username });
  if (existsUsername) return res.status(400).json({ error: 'Kullanıcı adı zaten var!' });
  const existsEmail = await User.findOne({ email });
  if (existsEmail) return res.status(400).json({ error: 'E-posta zaten kayıtlı!' });
  const user = new User({ username, email, phone, password, balance: 0 });
  await user.save();
  res.json({ success: true, user });
});

// Kullanıcı bakiyesi sorgulama
app.get('/api/balance', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  res.json({ balance: user.balance });
});

// Bakiye yükleme (arttırma)
app.post('/api/balance', async (req, res) => {
  const { username, amount } = req.body;
  if (!username || typeof amount !== 'number') return res.status(400).json({ error: 'Eksik parametre!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  user.balance += amount;
  await user.save();
  res.json({ success: true, balance: user.balance });
});

// Yeni paylaşım oluşturma
app.post('/api/post', async (req, res) => {
  try {
    const { username, imageUrl, caption } = req.body;
    if (!username || !imageUrl || !caption) return res.status(400).json({ error: 'Eksik parametre!' });
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    if (username !== 'admin') {
      if (user.balance < 19.9) return res.status(400).json({ error: 'Yetersiz bakiye!' });
      user.balance -= 19.9;
      await user.save();
    }
    const post = new Post({ username, imageUrl, caption });
    await post.save();
    res.json({ success: true, post });
  } catch (err) {
    console.error('POST /api/post error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Kullanıcının aktif postlarını çekme
app.get('/api/posts', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });
    const posts = await Post.find({ username, archived: false }).sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    console.error('GET /api/posts error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Kullanıcının arşivdeki postlarını çekme
app.get('/api/archives', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });
    const posts = await Post.find({ username, archived: true }).sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    console.error('GET /api/archives error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Postu arşivle
app.post('/api/archive', async (req, res) => {
  try {
    const { postId, username } = req.body;
    if (!postId || !username) return res.status(400).json({ error: 'Eksik parametre!' });
    const post = await Post.findOne({ _id: postId, username });
    if (!post) return res.status(404).json({ error: 'Post bulunamadı!' });
    post.archived = true;
    await post.save();
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/archive error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Postu arşivden çıkar
app.post('/api/unarchive', async (req, res) => {
  try {
    const { postId, username } = req.body;
    if (!postId || !username) return res.status(400).json({ error: 'Eksik parametre!' });
    const post = await Post.findOne({ _id: postId, username });
    if (!post) return res.status(404).json({ error: 'Post bulunamadı!' });
    post.archived = false;
    await post.save();
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/unarchive error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Kullanıcı silme
app.post('/api/delete-user', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Eksik parametre!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  if (user.password !== password) return res.status(400).json({ error: 'Şifre yanlış!' });
  await User.deleteOne({ username });
  await Post.deleteMany({ username });
  res.json({ success: true });
});

// Şifre değiştirme
app.post('/api/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) return res.status(400).json({ error: 'Eksik parametre!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  if (user.password !== oldPassword) return res.status(400).json({ error: 'Mevcut şifre yanlış!' });
  user.password = newPassword;
  await user.save();
  res.json({ success: true });
});

// Profil fotoğrafı güncelleme
app.post('/api/profile-image', async (req, res) => {
  const { username, image } = req.body;
  if (!username || !image) return res.status(400).json({ error: 'Eksik parametre!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  user.profileImage = image;
  await user.save();
  res.json({ success: true, profileImage: user.profileImage });
});

// Profil fotoğrafı getirme
app.get('/api/profile-image', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  res.json({ profileImage: user.profileImage || null });
});

// Post açıklamasını güncelleme
app.post('/api/update-post', async (req, res) => {
  const { postId, username, caption } = req.body;
  if (!postId || !username || !caption) return res.status(400).json({ error: 'Eksik parametre!' });
  const post = await Post.findOne({ _id: postId, username });
  if (!post) return res.status(404).json({ error: 'Post bulunamadı!' });
  post.caption = caption;
  await post.save();
  res.json({ success: true, post });
});

// Profil açıklaması güncelleme
app.post('/api/profile-desc', async (req, res) => {
  const { username, profileDesc } = req.body;
  if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  user.profileDesc = profileDesc || '';
  await user.save();
  res.json({ success: true });
});

// Profil açıklaması getirme
app.get('/api/profile-desc', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  res.json({ profileDesc: user.profileDesc || '' });
});

// Tüm aktif postları çekme (archived:false olanlar)
app.get('/api/posts-all', async (req, res) => {
  try {
    const posts = await Post.find({ archived: false }).sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    console.error('GET /api/posts-all error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Post beğenme/beğeniyi kaldırma
app.post('/api/post/like', async (req, res) => {
  try {
    const { postId, username } = req.body;
    if (!postId || !username) return res.status(400).json({ error: 'Eksik parametre!' });
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post bulunamadı!' });

    const likeIndex = post.likes.indexOf(username);
    if (likeIndex === -1) {
      post.likes.push(username);
    } else {
      post.likes.splice(likeIndex, 1);
    }
    await post.save();
    res.json({ success: true, likes: post.likes });
  } catch (err) {
    console.error('POST /api/post/like error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Yorum ekleme
app.post('/api/post/comment', async (req, res) => {
  try {
    const { postId, username, text } = req.body;
    if (!postId || !username || !text) return res.status(400).json({ error: 'Eksik parametre!' });
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post bulunamadı!' });

    post.comments.push({ username, text });
    await post.save();
    res.json({ success: true, comments: post.comments });
  } catch (err) {
    console.error('POST /api/post/comment error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Tekil post detayı getirme
app.get('/api/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post bulunamadı!' });
    res.json({ post });
  } catch (err) {
    console.error('GET /api/post/:postId error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Post açıklamasını güncelleme (yeni endpoint)
app.post('/api/post/edit-caption', async (req, res) => {
  try {
    const { postId, username, caption } = req.body;
    if (!postId || !username || !caption) return res.status(400).json({ error: 'Eksik parametre!' });
    const post = await Post.findOne({ _id: postId, username });
    if (!post) return res.status(404).json({ error: 'Post bulunamadı!' });
    post.caption = caption;
    await post.save();
    res.json({ caption: post.caption });
  } catch (err) {
    console.error('POST /api/post/edit-caption error:', err);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Kullanıcı giriş endpoint'i
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Eksik parametre!' });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
  if (user.password !== password) return res.status(400).json({ error: 'Şifre yanlış!' });
  res.json({ user: { username: user.username, email: user.email, profileImage: user.profileImage, profileDesc: user.profileDesc } });
});

// Sunucuyu başlat
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Local network: http://192.168.1.103:${PORT}`);
});