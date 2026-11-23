import { useState, useEffect } from 'react';
import api from '../api';

export default function SocialsHub() {
    const [posts, setPosts] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [postForm, setPostForm] = useState({
        platform: 'Google Business',
        division: 'ALL',
        language: 'EN',
        headline: '',
        body_copy: '',
        cta_link: 'https://d2-transport.co.ke/track',
        status: 'Published'
    });

    const [reviewForm, setReviewForm] = useState({
        source_platform: 'Google Business',
        client_name: '',
        company_or_line: '',
        division: 'CONTAINER_DEPOT',
        rating: 5,
        review_text: '',
        admin_reply: ''
    });

    const loadSocials = async () => {
        try {
            const res = await api.get('/audit-socials/socials');
            setPosts(res.data.posts || []);
            setReviews(res.data.reviews || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load socials hub.');
        }
    };

    useEffect(() => {
        loadSocials();
    }, []);

    const handleCreatePost = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/audit-socials/socials/posts', postForm);
            setMessage(res.data.message);
            setPostForm({ platform: 'Google Business', division: 'ALL', language: 'EN', headline: '', body_copy: '', cta_link: 'https://d2-transport.co.ke/track', status: 'Published' });
            loadSocials();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to publish post.');
        }
    };

    const handleCreateReview = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await api.post('/audit-socials/socials/reviews', reviewForm);
            setMessage(res.data.message);
            setReviewForm({ source_platform: 'Google Business', client_name: '', company_or_line: '', division: 'CONTAINER_DEPOT', rating: 5, review_text: '', admin_reply: '' });
            loadSocials();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to log client review.');
        }
    };

    const copyPostToClipboard = (p) => {
        const text = `${p.headline}\n\n${p.body_copy}\n\nLive QR Tracking: ${p.cta_link || ''}`;
        navigator.clipboard?.writeText(text);
        setMessage(`Copied "${p.headline}" to clipboard for ${p.platform}.`);
    };

    return (
        <div style={{ backgroundColor: '#faf9f5', minHeight: '100vh', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', color: '#14281d' }}>
            <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
                <div style={{ backgroundColor: '#143628', color: '#f4f1ea', padding: '22px 26px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#d4af37' }}>
                            D2-TRANSPORT (K) LTD • BRAND VISIBILITY, GOOGLE BUSINESS & CLIENT TRUST
                        </div>
                        <h1 style={{ margin: '4px 0 0', fontSize: '24px' }}>Social Channels, Bilingual Campaigns & Verified Client Reviews</h1>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <a href="https://business.google.com" target="_blank" rel="noreferrer" style={{ padding: '8px 14px', backgroundColor: '#d4af37', color: '#14281d', borderRadius: '6px', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}>
                            Google Business Profile
                        </a>
                        <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" style={{ padding: '8px 14px', backgroundColor: '#1b4332', color: '#f4f1ea', border: '1px solid #2d5a44', borderRadius: '6px', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}>
                            LinkedIn Corporate
                        </a>
                    </div>
                </div>

                {error && <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>}
                {message && <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#14532d', borderRadius: '8px', marginBottom: '14px' }}>{message}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
                    {/* Campaign Composer & Feed */}
                    <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                        <h3 style={{ marginTop: 0 }}>Create Bilingual Campaign / Update (EN / IT)</h3>
                        <form onSubmit={handleCreatePost} style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <select value={postForm.platform} onChange={(e) => setPostForm({ ...postForm, platform: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="Google Business">Google Business</option>
                                    <option value="LinkedIn">LinkedIn</option>
                                    <option value="WhatsApp Channel">WhatsApp Channel</option>
                                    <option value="Instagram/X">Instagram / X</option>
                                </select>
                                <select value={postForm.division} onChange={(e) => setPostForm({ ...postForm, division: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="ALL">All Divisions</option>
                                    <option value="FREIGHT_TRANSPORT">Heavy Freight</option>
                                    <option value="CONTAINER_DEPOT">Container Depot</option>
                                    <option value="GARAGE">Commercial Garage</option>
                                </select>
                                <select value={postForm.language} onChange={(e) => setPostForm({ ...postForm, language: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="EN">English (EN)</option>
                                    <option value="IT">Italiano (IT)</option>
                                </select>
                            </div>
                            <input required placeholder="Headline (e.g. Athi River–Kisumu Heavy Corridor & KEPHIS Container Depot)" value={postForm.headline} onChange={(e) => setPostForm({ ...postForm, headline: e.target.value })} style={{ padding: '8px' }} />
                            <textarea rows={3} required placeholder="Write post copy..." value={postForm.body_copy} onChange={(e) => setPostForm({ ...postForm, body_copy: e.target.value })} style={{ padding: '8px' }} />
                            <input placeholder="QR / Tracking CTA Link" value={postForm.cta_link} onChange={(e) => setPostForm({ ...postForm, cta_link: e.target.value })} style={{ padding: '8px' }} />
                            <button type="submit" style={{ padding: '10px', backgroundColor: '#143628', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                                Save & Publish Campaign
                            </button>
                        </form>

                        <h4 style={{ margin: '0 0 10px' }}>Campaign Feed ({posts.length})</h4>
                        {posts.map((p) => (
                            <div key={p.id} style={{ borderTop: '1px solid #e5e7eb', padding: '10px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>{p.headline}</strong>
                                    <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#eef2ee', borderRadius: '999px', fontWeight: 700 }}>
                                        {p.platform} • {p.language}
                                    </span>
                                </div>
                                <p style={{ margin: '6px 0', fontSize: '13px', color: '#334155' }}>{p.body_copy}</p>
                                <button type="button" onClick={() => copyPostToClipboard(p)} style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #143628', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>
                                    Copy Ready-to-Post Text
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Verified Client & Shipping Line Reviews */}
                    <div style={{ backgroundColor: '#fff', border: '1px solid #d6d3c9', borderRadius: '10px', padding: '18px' }}>
                        <h3 style={{ marginTop: 0 }}>Log Verified Client / Principal Review</h3>
                        <form onSubmit={handleCreateReview} style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <input required placeholder="Client Contact Name" value={reviewForm.client_name} onChange={(e) => setReviewForm({ ...reviewForm, client_name: e.target.value })} style={{ padding: '8px' }} />
                                <input placeholder="Shipping Line / Company" value={reviewForm.company_or_line} onChange={(e) => setReviewForm({ ...reviewForm, company_or_line: e.target.value })} style={{ padding: '8px' }} />
                                <select value={reviewForm.division} onChange={(e) => setReviewForm({ ...reviewForm, division: e.target.value })} style={{ padding: '8px' }}>
                                    <option value="CONTAINER_DEPOT">Container Depot</option>
                                    <option value="FREIGHT_TRANSPORT">Heavy Freight Transport</option>
                                    <option value="GARAGE">Commercial Garage</option>
                                </select>
                                <select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })} style={{ padding: '8px' }}>
                                    <option value={5}>5 Stars — Exceptional</option>
                                    <option value={4}>4 Stars — Strong</option>
                                    <option value={3}>3 Stars — Satisfactory</option>
                                </select>
                            </div>
                            <textarea rows={2} required placeholder="Client feedback..." value={reviewForm.review_text} onChange={(e) => setReviewForm({ ...reviewForm, review_text: e.target.value })} style={{ padding: '8px' }} />
                            <input placeholder="Official Management Reply (Optional)" value={reviewForm.admin_reply} onChange={(e) => setReviewForm({ ...reviewForm, admin_reply: e.target.value })} style={{ padding: '8px' }} />
                            <button type="submit" style={{ padding: '10px', backgroundColor: '#1b4332', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                                Save Client Review
                            </button>
                        </form>

                        <h4 style={{ margin: '0 0 10px' }}>Client Reputation Ledger ({reviews.length})</h4>
                        {reviews.map((r) => (
                            <div key={r.id} style={{ borderTop: '1px solid #e5e7eb', padding: '10px 0', fontSize: '13px' }}>
                                <strong>{r.client_name}</strong> {r.company_or_line ? `(${r.company_or_line})` : ''} — {'★'.repeat(r.rating)}
                                <p style={{ margin: '4px 0', color: '#334155' }}>"{r.review_text}"</p>
                                {r.admin_reply && <div style={{ fontSize: '12px', color: '#143628' }}><strong>Reply:</strong> {r.admin_reply}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}