import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Bell, Check, ChefHat, ChevronDown, ChevronRight,
  Clock3, CreditCard, Flame, Heart, Home, LogIn, LogOut, MapPin, Minus,
  PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles,
  Star, Store, Truck, UserRound, Utensils, Wallet, X, RefreshCw, CircleHelp,
} from 'lucide-react';
import { api, authStore, dateTime, money } from './api';
import { CATEGORIES, MENU } from './menu';

const FALLBACK_RESTAURANT_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=85';
const MENU_IMAGES = MENU.map((item) => item.image);

const ORDER_STATUS = {
  pending: ['Chờ xác nhận', 'status-pending'],
  confirmed: ['Đã xác nhận', 'status-confirmed'],
  preparing: ['Đang chuẩn bị', 'status-preparing'],
  ready: ['Sẵn sàng giao', 'status-ready'],
  delivering: ['Đang giao', 'status-delivering'],
  completed: ['Hoàn tất', 'status-completed'],
  cancelled: ['Đã hủy', 'status-cancelled'],
};
const PAYMENT_STATUS = {
  pending: ['Chờ thanh toán', 'status-pending'],
  paid: ['Đã thanh toán', 'status-completed'],
  failed: ['Thanh toán thất bại', 'status-failed'],
  refunded: ['Đã hoàn tiền', 'status-refunded'],
};

function StatusPill({ value, type = 'order' }) {
  const pair = (type === 'payment' ? PAYMENT_STATUS : ORDER_STATUS)[value] || [value || 'Chưa rõ', 'status-pending'];
  return <span className={`status-pill ${pair[1]}`}><span />{pair[0]}</span>;
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={19} /></button>
        <div className="modal-heading"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {children}
      </section>
    </div>
  );
}

function FoodLogo() {
  return <div className="brand-mark"><span className="brand-icon"><Utensils size={19} strokeWidth={2.7} /></span><span>foodie<span className="brand-dot">.</span></span></div>;
}

export default function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [restaurantsError, setRestaurantsError] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [page, setPage] = useState('explore');
  const [category, setCategory] = useState('Tất cả');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [cartRestaurant, setCartRestaurant] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(authStore.user());
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState({ address: '', note: '', paymentMethod: 'online' });
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [restaurantQuery, setRestaurantQuery] = useState('');
  const [restaurantBusyId, setRestaurantBusyId] = useState(null);

  const notify = useCallback((message, kind = 'success') => {
    setToast({ message, kind });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const loadRestaurants = useCallback(async () => {
    setRestaurantsLoading(true);
    setRestaurantsError('');
    try {
      const data = await api('/restaurants');
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      setRestaurants(list);
      setSelectedRestaurant((current) => current || list[0] || null);
    } catch (error) {
      setRestaurantsError(error.message);
      setRestaurants([]);
    } finally {
      setRestaurantsLoading(false);
    }
  }, []);

  useEffect(() => { loadRestaurants(); }, [loadRestaurants]);

  useEffect(() => {
    const token = authStore.token();
    if (!token) return;
    api('/auth/profile').then((profile) => {
      setUser((current) => ({ ...(current || {}), ...profile }));
    }).catch(() => {
      authStore.clear();
      setUser(null);
    });
  }, []);

  const loadOrders = useCallback(async () => {
    if (!authStore.token()) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const data = await api('/orders');
      setOrders(Array.isArray(data) ? data : (data?.items || data?.data || []));
    } catch (error) {
      setOrdersError(error.message);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (page === 'orders' && user) loadOrders();
  }, [page, user, loadOrders]);

  const filteredMenu = useMemo(() => MENU.filter((item) => {
    const categoryMatch = category === 'Tất cả' || item.category === category;
    const searchMatch = `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  }), [category, search]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const adminRestaurants = useMemo(() => restaurants.filter((restaurant) => {
    const matchesStatus = restaurantFilter === 'all' || restaurant.status === restaurantFilter;
    const query = restaurantQuery.trim().toLowerCase();
    const matchesQuery = !query || `${restaurant.name || ''} ${restaurant.address || ''} ${restaurant.email || ''} ${restaurant.phone || ''}`.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  }), [restaurants, restaurantFilter, restaurantQuery]);

  const restaurantCounts = useMemo(() => ({
    all: restaurants.length,
    pending: restaurants.filter((restaurant) => restaurant.status === 'pending').length,
    active: restaurants.filter((restaurant) => restaurant.status === 'active').length,
    inactive: restaurants.filter((restaurant) => restaurant.status === 'inactive').length,
  }), [restaurants]);

  const addToCart = (item) => {
    if (!selectedRestaurant) {
      notify('Chưa có nhà hàng để đặt món.', 'error');
      return;
    }
    if (cartRestaurant && cartRestaurant.id !== selectedRestaurant.id) {
      const shouldReplace = window.confirm('Giỏ hàng đang thuộc nhà hàng khác. Bạn muốn xóa giỏ cũ và chọn nhà hàng này?');
      if (!shouldReplace) return;
      setCart([]);
    }
    setCartRestaurant(selectedRestaurant);
    setCart((current) => {
      const exists = current.find((entry) => entry.id === item.id);
      return exists
        ? current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
        : [...current, { ...item, quantity: 1 }];
    });
    notify(`Đã thêm ${item.name} vào giỏ hàng.`);
  };

  const changeQuantity = (id, delta) => {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      if (authMode === 'register') {
        await api('/users', {
          method: 'POST',
          body: JSON.stringify({ fullName: values.fullName, email: values.email, password: values.password, phone: values.phone || undefined }),
        });
        notify('Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.');
        setAuthMode('login');
      } else {
        const result = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: values.email, password: values.password }),
        });
        authStore.save(result.access_token, result.user);
        setUser(result.user);
        setAuthOpen(false);
        notify(`Xin chào ${result.user?.fullName || 'bạn'}!`);
        if (page === 'orders') loadOrders();
      }
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateRestaurantStatus = async (restaurant, status) => {
    setRestaurantBusyId(restaurant.id);

    try {
      const updated = await api(
        `/restaurants/${restaurant.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );

      if (updated?.status !== status) {
        throw new Error(
          'Backend chưa xác nhận trạng thái mới. Vui lòng tải lại dữ liệu.'
        );
      }

      setRestaurants((current) =>
        current.map((item) =>
          item.id === restaurant.id
            ? { ...item, ...updated }
            : item
        )
      );

      notify(
        status === 'active'
          ? `Đã kích hoạt ${restaurant.name}.`
          : status === 'inactive'
            ? `Đã ngừng hoạt động ${restaurant.name}.`
            : `Đã đưa ${restaurant.name} về trạng thái chờ duyệt.`
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setRestaurantBusyId(null);
    }
  };

  const logout = () => {
    authStore.clear();
    setUser(null);
    setOrders([]);
    setSelectedOrder(null);
    setPage('explore');
    notify('Bạn đã đăng xuất.');
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!user) {
      setCheckoutOpen(false);
      openAuth('login');
      notify('Đăng nhập để xác nhận đơn hàng.', 'info');
      return;
    }
    if (!selectedRestaurant || cart.length === 0) return;
    setBusy(true);
    let created;
    try {
      created = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          deliveryAddress: checkout.address.trim(),
          note: checkout.note.trim() || undefined,
          paymentMethod: checkout.paymentMethod,
          items: cart.map(({ id, name, price, quantity }) => ({
            productId: id,
            productName: name,
            unitPrice: price,
            quantity,
          })),
        }),
      });
      setCart([]);
      setCartRestaurant(null);
      setCheckoutOpen(false);
      setCartOpen(false);
      if (checkout.paymentMethod === 'online') {
        try {
          const payment = await api('/payments', {
            method: 'POST',
            body: JSON.stringify({ orderId: created.id }),
          });
          notify(payment?.message || 'Đơn hàng đã tạo và yêu cầu thanh toán đã được gửi.');
        } catch (paymentError) {
          notify(`Đã tạo đơn ${created.id.slice(0, 8)} nhưng thanh toán chưa hoàn tất: ${paymentError.message}`, 'error');
        }
      } else {
        notify('Đặt hàng thành công! Bạn sẽ thanh toán khi nhận món.');
      }
      setPage('orders');
      await loadOrders();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const showOrderDetail = async (order) => {
    setDetailLoading(true);
    setSelectedOrder(order);
    try {
      const full = await api(`/orders/${order.id}`);
      setSelectedOrder(full);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const retryPayment = async (order) => {
    setBusy(true);
    try {
      const result = await api('/payments', { method: 'POST', body: JSON.stringify({ orderId: order.id }) });
      notify(result?.message || 'Đã gửi yêu cầu thanh toán lại.');
      await loadOrders();
      if (selectedOrder?.id === order.id) {
        const fresh = await api(`/orders/${order.id}`);
        setSelectedOrder(fresh);
      }
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (order) => {
    if (!window.confirm('Bạn chắc chắn muốn hủy đơn hàng này?')) return;
    setBusy(true);
    try {
      const fresh = await api(`/orders/${order.id}/cancel`, { method: 'PATCH' });
      notify('Đã hủy đơn hàng.');
      await loadOrders();
      setSelectedOrder(fresh);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const chooseRestaurant = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setPage('explore');
    window.scrollTo({ top: document.getElementById('menu-section')?.offsetTop || 0, behavior: 'smooth' });
  };

  const startCheckout = () => {
    setCartOpen(false);
    if (!user) {
      openAuth('login');
      notify('Đăng nhập trước khi đặt hàng.', 'info');
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <div className="app-shell">
      <div className="announcement"><Sparkles size={14} /> Ưu đãi hôm nay · Miễn phí giao hàng cho đơn từ 150.000đ <span>Khám phá ngay</span><ArrowUpRight size={13} /></div>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand-button" onClick={() => setPage('explore')}><FoodLogo /></button>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <button className={page === 'explore' ? 'active' : ''} onClick={() => setPage('explore')}><Home size={16} />Khám phá</button>
            <button className={page === 'orders' ? 'active' : ''} onClick={() => user ? setPage('orders') : openAuth('login')}><PackageCheck size={16} />Đơn hàng</button>
            {user?.role === 'admin' && <button className={page === 'admin' ? 'active' : ''} onClick={() => { setPage('admin'); loadRestaurants(); }}><ShieldCheck size={16} />Quản trị</button>}
          </nav>
          <div className="header-actions">
            <button className="header-cart" onClick={() => setCartOpen(true)} aria-label="Mở giỏ hàng"><ShoppingBag size={18} /><span>Giỏ hàng</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
            {user ? (
              <div className="user-menu">
                <button className="user-trigger" onClick={() => setPage('orders')}><span className="avatar">{(user.fullName || user.email || 'U').slice(0, 1).toUpperCase()}</span><span className="user-name">{user.fullName || user.email}</span><ChevronDown size={15} /></button>
                <button className="logout-button" onClick={logout}><LogOut size={15} />Đăng xuất</button>
              </div>
            ) : <button className="primary-button small" onClick={() => openAuth('login')}><UserRound size={16} />Đăng nhập</button>}
          </div>
        </div>
      </header>

      <main>
        {page === 'explore' ? (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-dot" /> NGON MỖI NGÀY, VUI MỖI BỮA</div>
                <h1>Món ngon đến cửa,<br /><em>niềm vui</em> đến nhà.</h1>
                <p>Khám phá những hương vị bạn yêu thích và đặt món thật dễ dàng. Bữa ăn ngon chỉ cách bạn vài cú chạm.</p>
                <div className="hero-actions"><button className="primary-button" onClick={() => document.getElementById('restaurants-section')?.scrollIntoView({ behavior: 'smooth' })}>Đặt món ngay <ArrowRight size={17} /></button><div className="hero-social"><div className="avatar-stack"><span>H</span><span>M</span><span>A</span></div><div><strong>4.9/5</strong><small>Được yêu thích bởi khách hàng</small></div></div></div>
                <div className="hero-benefits"><span><Truck size={16} /> Giao nhanh tận nơi</span><span><ShieldCheck size={16} /> Đặt món an tâm</span></div>
              </div>
              <div className="hero-art">
                <div className="hero-glow" />
                <img className="hero-food" src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1100&q=90" alt="Bữa ăn ngon" />
                <div className="floating-card delivery-card"><span className="float-icon mint"><Truck size={18} /></span><div><strong>Giao hàng nhanh</strong><small>Chỉ từ 20–30 phút</small></div><Check size={17} className="float-check" /></div>
                <div className="floating-card rating-card"><span className="rating-star"><Star size={16} fill="currentColor" /></span><div><strong>4.9 <small>/ 5.0</small></strong><small>Đánh giá tuyệt vời</small></div></div>
                <div className="hero-stamp"><span>FRESH</span><strong>&</strong><span>HAPPY</span></div>
              </div>
            </section>

            <section className="perks container">
              <div className="perk"><span className="perk-icon coral"><Truck size={19} /></span><div><strong>Giao hàng tận nơi</strong><small>Tiện lợi, đúng hẹn</small></div></div>
              <div className="perk"><span className="perk-icon yellow"><ChefHat size={19} /></span><div><strong>Món ngon chất lượng</strong><small>Chọn lọc mỗi ngày</small></div></div>
              <div className="perk"><span className="perk-icon blue"><CreditCard size={19} /></span><div><strong>Thanh toán linh hoạt</strong><small>Online hoặc tiền mặt</small></div></div>
              <div className="perk"><span className="perk-icon green"><Heart size={19} /></span><div><strong>Luôn đặt bạn lên đầu</strong><small>Trải nghiệm thân thiện</small></div></div>
            </section>

            <section className="section container" id="restaurants-section">
              <div className="section-heading"><div><div className="eyebrow muted"><Flame size={14} /> ĐƯỢC YÊU THÍCH</div><h2>Nhà hàng nổi bật</h2><p>Chọn một điểm đến cho chiếc bụng đói của bạn.</p></div><button className="text-button" onClick={loadRestaurants}>Làm mới danh sách <RefreshCw size={15} /></button></div>
              {restaurantsLoading ? <div className="loading-grid">{[1, 2, 3].map((n) => <div className="skeleton-card" key={n} />)}</div> : restaurantsError ? (
                <div className="empty-state inline-error"><Store size={26} /><strong>Chưa tải được danh sách nhà hàng</strong><p>{restaurantsError}</p><button className="secondary-button" onClick={loadRestaurants}><RefreshCw size={15} /> Thử lại</button></div>
              ) : restaurants.length === 0 ? (
                <div className="empty-state"><Store size={28} /><strong>Chưa có nhà hàng</strong><p>Hiện API chưa trả về nhà hàng nào. Hãy kiểm tra dữ liệu Restaurant Service.</p></div>
              ) : (
                <div className="restaurant-grid">{restaurants.map((restaurant, index) => (
                  <article className={`restaurant-card ${selectedRestaurant?.id === restaurant.id ? 'selected' : ''}`} key={restaurant.id}>
                    <button className="restaurant-photo" onClick={() => chooseRestaurant(restaurant)}>
                      <img src={restaurant.imageUrl || [FALLBACK_RESTAURANT_IMAGE, MENU_IMAGES[1], MENU_IMAGES[4]][index % 3]} alt={restaurant.name} onError={(event) => { event.currentTarget.src = FALLBACK_RESTAURANT_IMAGE; }} />
                      <span className="photo-label"><Sparkles size={12} /> Gợi ý hôm nay</span>
                      <span className="photo-rating"><Star size={13} fill="currentColor" /> 4.8</span>
                    </button>
                    <div className="restaurant-info"><div><h3>{restaurant.name}</h3><p><MapPin size={13} />{restaurant.address || 'Địa chỉ đang cập nhật'}</p></div><button className="round-arrow" onClick={() => chooseRestaurant(restaurant)} aria-label={`Chọn ${restaurant.name}`}><ArrowUpRight size={18} /></button></div>
                    <div className="restaurant-meta"><span><Clock3 size={14} /> 20–35 phút</span><span className="meta-separator" /><span>{restaurant.phone || 'Nhận đơn trực tuyến'}</span></div>
                  </article>
                ))}</div>
              )}
            </section>

            <section className="menu-section" id="menu-section">
              <div className="container">
                <div className="section-heading menu-heading"><div><div className="eyebrow muted"><Utensils size={14} /> THỰC ĐƠN HÔM NAY</div><h2>Chọn món bạn thích</h2><p>{selectedRestaurant ? `Đang chọn: ${selectedRestaurant.name}` : 'Chọn nhà hàng để bắt đầu đặt món.'}</p></div><div className="menu-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm món ăn..." /></div></div>
                <div className="menu-toolbar"><div className="category-list">{CATEGORIES.map((item) => <button key={item} className={category === item ? 'category-chip active' : 'category-chip'} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="menu-note"><CircleHelp size={14} /> Thực đơn mẫu cho bản demo</div></div>
                <div className="menu-layout">
                  <div className="food-grid">{filteredMenu.map((item) => (
                    <article className="food-card" key={item.id}>
                      <div className="food-photo"><img src={item.image} alt={item.name} loading="lazy" /><span className="food-tag">{item.tag}</span><button className="food-fav" aria-label="Yêu thích"><Heart size={16} /></button></div>
                      <div className="food-info"><div className="food-title-row"><h3>{item.name}</h3><span className="food-rating"><Star size={12} fill="currentColor" />{item.rating}</span></div><p>{item.description}</p><div className="food-bottom"><div><strong>{money(item.price)}</strong><small><Clock3 size={12} />{item.time}</small></div><button className="add-button" onClick={() => addToCart(item)}><Plus size={17} /> Thêm</button></div></div>
                    </article>
                  ))}</div>
                  <aside className="mini-cart"><div className="mini-cart-top"><div><span className="cart-overline">ĐƠN CỦA BẠN</span><h3>Giỏ hàng <span>{cartCount}</span></h3></div><ShoppingBag size={21} /></div>
                    {cart.length === 0 ? <div className="mini-empty"><div className="empty-bag"><ShoppingBag size={24} /></div><strong>Giỏ hàng đang trống</strong><p>Thêm món ngon để bắt đầu đơn hàng của bạn nhé.</p></div> : <><div className="mini-items">{cart.slice(0, 3).map((item) => <div className="mini-item" key={item.id}><div><strong>{item.name}</strong><small>{item.quantity} × {money(item.price)}</small></div><b>{money(item.price * item.quantity)}</b></div>)}{cart.length > 3 && <p className="more-items">+ {cart.length - 3} món khác</p>}</div><div className="mini-total"><span>Tạm tính</span><strong>{money(cartTotal)}</strong></div><button className="primary-button full" onClick={() => setCartOpen(true)}>Xem giỏ hàng <ArrowRight size={16} /></button></>}
                    <div className="cart-assurance"><ShieldCheck size={15} /> Thanh toán an toàn, linh hoạt</div>
                  </aside>
                </div>
                <div className="catalog-disclaimer"><CircleHelp size={15} /><span>Ghi chú đồ án: dữ liệu món ăn hiện là catalog demo ở frontend. Backend hiện nhận chi tiết món trực tiếp trong đơn hàng, chưa có API CRUD sản phẩm/thực đơn.</span></div>
              </div>
            </section>
          </>
        ) : page === 'admin' ? (
          user?.role === 'admin' ? (
            <section className="admin-page container">
              <div className="admin-heading">
                <div>
                  <div className="eyebrow muted"><ShieldCheck size={14} /> TRUNG TÂM QUẢN TRỊ</div>
                  <h1>Quản lý nhà hàng</h1>
                  <p>Duyệt nhà hàng mới và kiểm soát trạng thái hoạt động.</p>
                </div>
                <button className="secondary-button" onClick={loadRestaurants} disabled={restaurantsLoading}><RefreshCw size={15} /> Làm mới dữ liệu</button>
              </div>

              <div className="admin-stat-grid">
                <div className="admin-stat-card"><span className="admin-stat-icon"><Store size={18} /></span><small>Tổng nhà hàng</small><strong>{restaurantCounts.all}</strong></div>
                <div className="admin-stat-card"><span className="admin-stat-icon pending"><Clock3 size={18} /></span><small>Chờ duyệt</small><strong>{restaurantCounts.pending}</strong></div>
                <div className="admin-stat-card"><span className="admin-stat-icon active"><Check size={18} /></span><small>Đang hoạt động</small><strong>{restaurantCounts.active}</strong></div>
                <div className="admin-stat-card"><span className="admin-stat-icon inactive"><X size={18} /></span><small>Ngừng hoạt động</small><strong>{restaurantCounts.inactive}</strong></div>
              </div>

              <div className="admin-toolbar">
                <div className="menu-search admin-search"><Search size={17} /><input value={restaurantQuery} onChange={(event) => setRestaurantQuery(event.target.value)} placeholder="Tìm theo tên, địa chỉ, email..." /></div>
                <div className="admin-filters">
                  {[['all', 'Tất cả'], ['pending', 'Chờ duyệt'], ['active', 'Đang hoạt động'], ['inactive', 'Ngừng hoạt động']].map(([value, label]) => <button key={value} className={restaurantFilter === value ? 'category-chip active' : 'category-chip'} onClick={() => setRestaurantFilter(value)}>{label}{value === 'pending' && restaurantCounts.pending > 0 ? ` (${restaurantCounts.pending})` : ''}</button>)}
                </div>
              </div>

              {restaurantsLoading ? <div className="orders-skeleton"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div> : restaurantsError ? (
                <div className="empty-state inline-error"><Store size={26} /><strong>Không tải được nhà hàng</strong><p>{restaurantsError}</p><button className="secondary-button" onClick={loadRestaurants}><RefreshCw size={15} /> Thử lại</button></div>
              ) : adminRestaurants.length === 0 ? (
                <div className="empty-state admin-empty"><Store size={28} /><strong>Không có nhà hàng phù hợp</strong><p>Thử thay đổi từ khóa hoặc bộ lọc trạng thái.</p></div>
              ) : (
                <div className="admin-restaurant-list">
                  {adminRestaurants.map((restaurant) => (
                    <article className="admin-restaurant-card" key={restaurant.id}>
                      <div className="admin-restaurant-avatar">{restaurant.imageUrl ? <img src={restaurant.imageUrl} alt={restaurant.name} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <Store size={22} />}</div>
                      <div className="admin-restaurant-info">
                        <div className="admin-restaurant-title"><h3>{restaurant.name}</h3><span className={`restaurant-state state-${restaurant.status || 'pending'}`}>{restaurant.status === 'active' ? 'Đang hoạt động' : restaurant.status === 'inactive' ? 'Ngừng hoạt động' : 'Chờ duyệt'}</span></div>
                        <p><MapPin size={13} /> {restaurant.address || 'Chưa cập nhật địa chỉ'}</p>
                        <div className="admin-restaurant-meta"><span>{restaurant.phone || 'Chưa có số điện thoại'}</span><span>{restaurant.email || 'Chưa có email'}</span></div>
                      </div>
                      <div className="admin-restaurant-actions">
                        {restaurant.status !== 'active' && <button className="primary-button small" disabled={restaurantBusyId === restaurant.id} onClick={() => updateRestaurantStatus(restaurant, 'active')}>{restaurantBusyId === restaurant.id ? 'Đang lưu...' : <><Check size={14} /> Duyệt / Kích hoạt</>}</button>}
                        {restaurant.status === 'active' && <button className="secondary-button" disabled={restaurantBusyId === restaurant.id} onClick={() => updateRestaurantStatus(restaurant, 'inactive')}><X size={14} /> Ngừng hoạt động</button>}
                        {restaurant.status === 'inactive' && <button className="secondary-button" disabled={restaurantBusyId === restaurant.id} onClick={() => updateRestaurantStatus(restaurant, 'pending')}><RefreshCw size={14} /> Đưa về chờ duyệt</button>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <div className="admin-note"><ShieldCheck size={16} /><span>Chỉ tài khoản có role <b>admin</b> mới thấy khu vực này. API Restaurant Service cũng xác thực quyền Admin khi thay đổi trạng thái. Quản lý toàn bộ đơn hàng chưa bật vì backend hiện chưa có API danh sách đơn hàng toàn hệ thống.</span></div>
            </section>
          ) : (
            <section className="orders-page container"><div className="empty-state orders-login"><ShieldCheck size={28} /><strong>Bạn không có quyền truy cập</strong><p>Khu vực quản trị chỉ dành cho tài khoản Admin.</p><button className="primary-button" onClick={() => setPage('explore')}>Về trang chủ</button></div></section>
          )
        ) : (
          <section className="orders-page container">
            <div className="orders-title-row"><div><div className="eyebrow muted"><PackageCheck size={14} /> THEO DÕI ĐƠN HÀNG</div><h1>Đơn hàng của bạn</h1><p>Quản lý đơn đã đặt, xem trạng thái và thanh toán lại khi cần.</p></div><button className="secondary-button" onClick={loadOrders}><RefreshCw size={15} /> Làm mới</button></div>
            {!user ? <div className="empty-state orders-login"><div className="empty-bag"><UserRound size={26} /></div><strong>Đăng nhập để xem đơn hàng</strong><p>Đơn hàng của bạn sẽ được đồng bộ từ Order Service.</p><button className="primary-button" onClick={() => openAuth('login')}>Đăng nhập <ArrowRight size={16} /></button></div> : ordersLoading ? <div className="orders-skeleton">{[1, 2, 3].map((n) => <div className="skeleton-row" key={n} />)}</div> : ordersError ? <div className="empty-state inline-error"><strong>Không thể tải đơn hàng</strong><p>{ordersError}</p><button className="secondary-button" onClick={loadOrders}>Thử lại</button></div> : orders.length === 0 ? <div className="empty-state orders-login"><div className="empty-bag"><ShoppingBag size={26} /></div><strong>Bạn chưa có đơn hàng nào</strong><p>Chọn món yêu thích và đặt đơn đầu tiên nhé.</p><button className="primary-button" onClick={() => setPage('explore')}>Khám phá món ngon <ArrowRight size={16} /></button></div> : (
              <div className="orders-layout"><div className="order-list">{orders.map((order) => <button className={`order-row ${selectedOrder?.id === order.id ? 'selected' : ''}`} key={order.id} onClick={() => showOrderDetail(order)}><div className="order-row-icon"><ShoppingBag size={19} /></div><div className="order-row-main"><div className="order-row-top"><strong>Đơn #{order.id.slice(0, 8).toUpperCase()}</strong><span>{dateTime(order.createdAt)}</span></div><div className="order-row-bottom"><StatusPill value={order.status} /><StatusPill value={order.paymentStatus} type="payment" /></div></div><div className="order-row-price"><strong>{money(order.totalAmount)}</strong><ChevronRight size={17} /></div></button>)}</div>
                <div className="order-detail-panel">{selectedOrder ? <OrderDetail order={selectedOrder} loading={detailLoading} busy={busy} onRetry={() => retryPayment(selectedOrder)} onCancel={() => cancelOrder(selectedOrder)} /> : <div className="detail-placeholder"><PackageCheck size={34} /><strong>Chọn một đơn hàng</strong><p>Thông tin chi tiết và trạng thái thanh toán sẽ hiển thị tại đây.</p></div>}</div></div>
            )}
          </section>
        )}
      </main>

      <footer className="site-footer"><div className="container footer-inner"><div><FoodLogo /><p>Gửi trọn vị ngon, trao trọn niềm vui.</p></div><div className="footer-links"><span>Đặt món dễ dàng</span><span>Thanh toán linh hoạt</span><span>Hỗ trợ khách hàng</span></div><small>© 2026 Foodie · Distributed Food Ordering System</small></div></footer>

      {cartOpen && <Modal title="Giỏ hàng của bạn" subtitle={cartRestaurant?.name || 'Kiểm tra món trước khi đặt hàng'} onClose={() => setCartOpen(false)} wide>
        {cart.length === 0 ? <div className="empty-state"><div className="empty-bag"><ShoppingBag size={26} /></div><strong>Chưa có món nào trong giỏ</strong><p>Hãy quay lại thực đơn và chọn món bạn yêu thích.</p><button className="primary-button" onClick={() => setCartOpen(false)}>Tiếp tục chọn món</button></div> : <div className="cart-modal-content"><div className="cart-modal-list">{cart.map((item) => <div className="cart-line" key={item.id}><img src={item.image} alt={item.name} /><div className="cart-line-info"><strong>{item.name}</strong><small>{money(item.price)} / phần</small><b>{money(item.price * item.quantity)}</b></div><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)} aria-label="Giảm"><Minus size={14} /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label="Tăng"><Plus size={14} /></button></div></div>)}</div><div className="cart-modal-summary"><div className="summary-line"><span>Tạm tính</span><strong>{money(cartTotal)}</strong></div><div className="summary-line"><span>Phí giao hàng</span><strong className="free-text">Tính khi xử lý</strong></div><div className="summary-total"><span>Tổng cộng</span><strong>{money(cartTotal)}</strong></div><button className="primary-button full" onClick={startCheckout}>Tiến hành đặt hàng <ArrowRight size={17} /></button><p className="summary-hint"><ShieldCheck size={14} /> Thông tin đơn hàng được gửi đến Order Service.</p></div></div>}
      </Modal>}

      {checkoutOpen && <Modal title="Xác nhận đặt hàng" subtitle="Chỉ còn một bước nữa là món ngon lên đường!" onClose={() => setCheckoutOpen(false)} wide>
        <form className="checkout-form" onSubmit={submitOrder}><div className="checkout-fields"><label>Địa chỉ nhận hàng <span>*</span><input required maxLength={255} value={checkout.address} onChange={(e) => setCheckout({ ...checkout, address: e.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện..." /></label><label>Ghi chú cho nhà hàng <small>Không bắt buộc</small><textarea maxLength={500} rows={3} value={checkout.note} onChange={(e) => setCheckout({ ...checkout, note: e.target.value })} placeholder="Ví dụ: ít cay, gọi trước khi giao..." /></label><div className="payment-choice"><strong>Phương thức thanh toán</strong><label className={checkout.paymentMethod === 'online' ? 'payment-option chosen' : 'payment-option'}><input type="radio" name="paymentMethod" value="online" checked={checkout.paymentMethod === 'online'} onChange={() => setCheckout({ ...checkout, paymentMethod: 'online' })} /><span className="payment-icon"><CreditCard size={18} /></span><span><b>Thanh toán online</b><small>Thanh toán mô phỏng qua Payment Service</small></span><span className="radio-dot" /></label><label className={checkout.paymentMethod === 'cash' ? 'payment-option chosen' : 'payment-option'}><input type="radio" name="paymentMethod" value="cash" checked={checkout.paymentMethod === 'cash'} onChange={() => setCheckout({ ...checkout, paymentMethod: 'cash' })} /><span className="payment-icon cash"><Wallet size={18} /></span><span><b>Tiền mặt khi nhận hàng</b><small>Thanh toán trực tiếp khi giao món</small></span><span className="radio-dot" /></label></div></div><aside className="checkout-summary"><span className="cart-overline">TÓM TẮT ĐƠN</span><h3>{cartRestaurant?.name || selectedRestaurant?.name}</h3>{cart.map((item) => <div className="checkout-item" key={item.id}><span>{item.quantity} × {item.name}</span><b>{money(item.quantity * item.price)}</b></div>)}<div className="summary-total"><span>Tổng thanh toán</span><strong>{money(cartTotal)}</strong></div><button className="primary-button full" type="submit" disabled={busy}>{busy ? 'Đang gửi đơn...' : 'Xác nhận đặt hàng'} <ArrowRight size={16} /></button><p className="summary-hint"><ShieldCheck size={14} /> Dữ liệu được xác thực tại backend.</p></aside></form>
      </Modal>}

      {authOpen && <Modal title={authMode === 'login' ? 'Chào mừng trở lại!' : 'Tạo tài khoản Foodie'} subtitle={authMode === 'login' ? 'Đăng nhập để tiếp tục hành trình món ngon.' : 'Đăng ký nhanh để lưu lại những đơn hàng yêu thích.'} onClose={() => setAuthOpen(false)}>
        <form className="auth-form" onSubmit={handleAuth}>
          {authMode === 'register' && <label>Họ và tên<input name="fullName" required maxLength={100} placeholder="Nguyễn Văn A" /></label>}
          <label>Email<input name="email" type="email" autoComplete="email" required placeholder="ban@email.com" /></label>
          {authMode === 'register' && <label>Số điện thoại <small>Không bắt buộc</small><input name="phone" type="tel" placeholder="09xx xxx xxx" /></label>}
          <label>Mật khẩu<input name="password" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={authMode === 'register' ? 8 : 1} required placeholder={authMode === 'register' ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'} /></label>
          <button className="primary-button full auth-submit" disabled={busy}>{busy ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} <ArrowRight size={16} /></button>
        </form>
        <div className="auth-switch">{authMode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</button></div>
      </Modal>}

      {toast && <div className={`toast toast-${toast.kind}`}><span>{toast.kind === 'error' ? <X size={17} /> : <Check size={17} />}</span>{toast.message}<button onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

function OrderDetail({ order, loading, busy, onRetry, onCancel }) {
  if (loading) return <div className="detail-placeholder"><RefreshCw className="spin" size={25} /><strong>Đang tải chi tiết...</strong></div>;

  // Online orders that are pending or failed must remain payable.
  // Cancelled, paid and refunded orders must not expose the payment action.
  const canPayOnline =
    order.paymentMethod === 'online' &&
    ['pending', 'failed'].includes(order.paymentStatus) &&
    order.status !== 'cancelled';

  const paymentButtonLabel = order.paymentStatus === 'failed'
    ? 'Thanh toán lại'
    : 'Thanh toán ngay';

  return (
    <div className="order-detail">
      <div className="detail-title">
        <div>
          <span className="cart-overline">CHI TIẾT ĐƠN HÀNG</span>
          <h3>#{order.id.slice(0, 8).toUpperCase()}</h3>
          <small>{dateTime(order.createdAt)}</small>
        </div>
        <div className="detail-icon"><PackageCheck size={22} /></div>
      </div>

      <div className="detail-statuses">
        <div><small>Trạng thái đơn</small><StatusPill value={order.status} /></div>
        <div><small>Thanh toán</small><StatusPill value={order.paymentStatus} type="payment" /></div>
      </div>

      <div className="timeline">
        <div className="timeline-step done">
          <span><Check size={12} /></span>
          <div><b>Đã tiếp nhận đơn</b><small>{dateTime(order.createdAt)}</small></div>
        </div>
        <div className={`timeline-step ${order.paymentStatus === 'paid' ? 'done' : ''}`}>
          <span>{order.paymentStatus === 'paid' ? <Check size={12} /> : <CreditCard size={12} />}</span>
          <div>
            <b>{order.paymentStatus === 'paid' ? 'Thanh toán thành công' : order.paymentStatus === 'failed' ? 'Thanh toán chưa thành công' : 'Chờ thanh toán'}</b>
            <small>{order.paymentMethod === 'online' ? 'Thanh toán online' : 'Tiền mặt khi nhận hàng'}</small>
          </div>
        </div>
      </div>

      <div className="detail-block">
        <strong>Món đã đặt</strong>
        {(order.items || []).map((item) => (
          <div className="detail-item" key={item.id || item.productId}>
            <span>{item.quantity} × {item.productName}</span>
            <b>{money(item.subtotal || Number(item.unitPrice) * Number(item.quantity))}</b>
          </div>
        ))}
      </div>

      <div className="detail-block address-block">
        <strong><MapPin size={15} /> Địa chỉ giao hàng</strong>
        <p>{order.deliveryAddress || '—'}</p>
        {order.note && <small>Ghi chú: {order.note}</small>}
      </div>

      <div className="detail-total"><span>Tổng cộng</span><strong>{money(order.totalAmount)}</strong></div>

      <div className="detail-actions">
        {order.paymentMethod === 'online' &&
          ['pending', 'failed'].includes(order.paymentStatus) &&
          order.status !== 'cancelled' && (
            <button
              className="primary-button full"
              disabled={busy}
              onClick={onRetry}
            >
              {busy ? (
                'Đang xử lý thanh toán...'
              ) : (
                <>
                  <CreditCard size={15} />
                  {order.paymentStatus === 'failed'
                    ? 'Thanh toán lại'
                    : 'Thanh toán ngay'}
                </>
              )}
            </button>
          )}

        {order.status === 'pending' && (
          <button
            className="secondary-button full danger-button"
            disabled={busy}
            onClick={onCancel}
          >
            Hủy đơn hàng
          </button>
        )}
      </div>
    </div>
  );
}
