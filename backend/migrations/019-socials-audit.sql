CREATE TABLE IF NOT EXISTS social_posts_campaigns (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(40) NOT NULL, -- 'Google Business' | 'LinkedIn' | 'WhatsApp Channel' | 'Instagram/X'
    division VARCHAR(30) NOT NULL DEFAULT 'ALL', -- 'ALL' | 'FREIGHT_TRANSPORT' | 'CONTAINER_DEPOT' | 'GARAGE'
    language VARCHAR(10) NOT NULL DEFAULT 'EN', -- 'EN' | 'IT'
    headline VARCHAR(160) NOT NULL,
    body_copy TEXT NOT NULL,
    cta_link VARCHAR(255),
    status VARCHAR(25) NOT NULL DEFAULT 'Draft', -- 'Draft' | 'Scheduled' | 'Published'
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_reputation_reviews (
    id SERIAL PRIMARY KEY,
    source_platform VARCHAR(40) NOT NULL DEFAULT 'Google Business',
    client_name VARCHAR(120) NOT NULL,
    company_or_line VARCHAR(120),
    division VARCHAR(30) NOT NULL DEFAULT 'CONTAINER_DEPOT',
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL,
    admin_reply TEXT,
    featured_on_home BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);