# Article Image — Size Guide + AI Prompt

> Yeh guide site ke actual code se verify ki gayi hai. Ek hi image 3 jagah dikhti hai,
> isliye composition sabse important hai.

## Image kahan-kahan dikhti hai

| Jagah | Display size | Ratio | Crop |
|---|---|---|---|
| Homepage slideshow (desktop) | ~600 × 460 px right panel | ≈ 4:3 | center crop, sides katte hain |
| Homepage slideshow (mobile) | full-width × 220 px top strip | ≈ 1.6:1 | center crop, upar-neeche katta hai |
| Article detail page | max 680 px wide hero | 16:9 | center crop |

**Important:** homepage card me text image ke UPAR overlay NAHI hota — text alag left
panel me hai, image apne alag right panel me. Isliye image ke left side ko khali
chhodne ki zaroorat nahi hai. Site khud image ke left/bottom edge pe halka dark
gradient (veil) daalti hai taaki card se blend ho.

## Sahi size (yehi use karo)

- **Dimensions: 1920 × 1080 px (16:9)** — minimum 1280 × 720 px
- **Format:** WebP ya JPG (PNG ki zaroorat nahi)
- **File size:** 500 KB se kam (WebP best)
- **Composition (sabse important):**
  - Subject/face **CENTER me** rakho (thoda upar-center chalega) — 2:1 ya right-side
    composition mat banao, desktop card sides se ~13-15% kaat deta hai
  - Har edge se **~15% margin** me kuch important mat rakho — slideshow me Ken Burns
    zoom hai jo shuru me edges hide karta hai, aur alag-alag screens pe crop hota hai
  - Edges dark/atmospheric rakho — card ke dark theme se blend hoga

## Kyun 16:9, kyun center?

- Article detail page ka hero exactly 16:9 hai → wahan zero crop
- Desktop slideshow ka image panel ≈ 4:3 hai → 16:9 se sirf sides thoda katta hai;
  agar subject center me hai to kuch nahi katta
- Sab jagah `object-fit: cover` **center** crop use hota hai — top-right ya koi
  corner favour nahi hota, isliye subject center me hi safe hai
- 1920 px width retina ke liye kaafi hai (image max ~680 px pe dikhti hai)

## AI Image Generator Prompt (copy-paste)

```
Dark cinematic digital illustration, 16:9 aspect ratio, 1920x1080.
[SUBJECT DESCRIPTION HERE — e.g. "a regal male character with long crimson
red hair and a dark ornate outfit"] positioned in the CENTER of the frame,
face slightly above center. Keep a generous margin on all four edges —
nothing important within 15% of any edge. Edges fade into dark atmospheric
space (black smoke, faint embers, deep shadows). Moody low-key lighting,
deep blacks, rich red and gold accents, painterly anime style.
No text, no watermark, no logo.
```

> `[SUBJECT DESCRIPTION HERE]` ko har article ke hisaab se badal do.

## Photoshop/Canva me khud banao to

1. Canvas: 1920 × 1080 px
2. Subject center me, face thoda upar-center
3. Charon edges pe dark vignette/atmosphere
4. Export: WebP ya JPG, quality 80

## Checklist upload se pehle

- [ ] 16:9 ratio (1920 × 1080)
- [ ] Subject CENTER me, edges se 15% door
- [ ] Edges dark/atmospheric
- [ ] < 500 KB
- [ ] Koi text/watermark nahi
