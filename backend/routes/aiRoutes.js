const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const pool = require('../config/db');

router.post('/inspect-image', async (req, res) => {
  const {
    image_base64,
    mime_type = 'image/jpeg',
    mode = 'FAULT_CODE',
    vehicle_make = null,
    notes = null,
  } = req.body || {};

  if (
    typeof image_base64 !== 'string' ||
    image_base64.length === 0 ||
    image_base64.length > 9_000_000 ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(mime_type) ||
    !['FAULT_CODE', 'PART_LABEL'].includes(mode)
  ) {
    return res.status(400).json({ error: 'A supported image, MIME type, and inspection mode are required.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const promptText =
    mode === 'PART_LABEL'
      ? [
          'Extract part details from this heavy commercial truck/trailer part label or box photo.',
          vehicle_make ? `Vehicle context make: ${vehicle_make}.` : '',
          notes ? `Mechanic/storekeeper notes: ${notes}.` : '',
          'Return strict JSON with keys: part_name, oem_number, aftermarket_numbers (array), batch_or_serial, brand_guess, summary.',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          'Inspect this heavy-duty commercial truck/trailer fault display, diagnostic readout, or component photo.',
          vehicle_make ? `Vehicle make: ${vehicle_make}.` : '',
          notes ? `Mechanic notes: ${notes}.` : '',
          'Return strict JSON with keys: fault_codes (array), likely_system, possible_causes (array), suggested_parts (array of part names/numbers), severity_suggestion (LOW|MEDIUM|HIGH|CRITICAL), summary.',
        ]
          .filter(Boolean)
          .join(' ');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: image_base64,
            mimeType: mime_type,
          },
        },
        promptText,
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    let parsed = {};
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = { raw_text: response.text };
    }

    let matchedInventory = [];
    const candidateTerms = [
      parsed.oem_number,
      ...(Array.isArray(parsed.aftermarket_numbers) ? parsed.aftermarket_numbers : []),
      ...(Array.isArray(parsed.suggested_parts) ? parsed.suggested_parts : []),
      parsed.part_name,
    ].filter(Boolean);

    if (candidateTerms.length > 0) {
      const patterns = candidateTerms.map((term) => `%${String(term).trim()}%`);
      const invRes = await pool.query(
        `SELECT id, sku, part_name, category, oem_number, aftermarket_equivalents,
                qty_on_hand, qty_reserved, (qty_on_hand - qty_reserved) AS qty_available,
                selling_price
         FROM inventory_items
         WHERE part_name ILIKE ANY($1::text[])
            OR COALESCE(oem_number, '') ILIKE ANY($1::text[])
            OR aftermarket_equivalents::text ILIKE ANY($1::text[])
         LIMIT 10`,
        [patterns]
      );
      matchedInventory = invRes.rows;
    }

    return res.json({
      mode,
      extraction: parsed,
      matched_inventory: matchedInventory,
    });
  } catch (error) {
    console.error('Garage AI image inspection failed:', error);
    return res.status(500).json({ error: 'Garage AI image inspection failed.' });
  }
});

module.exports = router;