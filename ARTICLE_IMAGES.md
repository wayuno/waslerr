# Article Image — Size Guide + AI Prompt

> Homepage slideshow ab **full-bleed overlay** hai: ek hi image poore card me
> phailti hai, text uske UPAR left side pe aata hai, aur image ke chaaro edges
> pure black me fade ho jaate hain (card black background me seamlessly blend).

## Sahi size (yehi use karo)

- **Dimensions: 2400 × 1200 px (2:1 wide)** — minimum 1600 × 800 px
- **Format:** WebP ya JPG (PNG ki zaroorat nahi)
- **File size:** 500 KB se kam (WebP best)
- **Composition (sabse important):**
  - Subject/character/face **slightly right-of-center** rakho, face **upper half** me
  - **Left third dark/khali** — wahan text overlay (badge, date, title, button) aata hai
  - **Chaaro edges pure black me fade** hone chahiye (heavy dark vignette) — site khud
    bhi edges pe black fade daalti hai, to source image bhi faded hoga to seamless lagega
  - Kinaron pe koi important cheez mat rakho — slideshow me halka Ken Burns zoom hai
    aur alag screens pe thoda crop hota hai

## Kyun 2:1 + edges black?

- Card full-bleed hai (~2.4:1 desktop), image 2:1 → sirf halka top/bottom crop
- Text image ke upar overlay hota hai, isliye left third ka dark hona zaroori hai
- Card ka background pure black (#070508) hai; image ke edges black me fade honge to
  card page me bina seam ke ghul jayega (jaisa reference me chahiye tha)
- 2400 px width retina ke liye sharp

## AI Image Generator Prompt (copy-paste)

```
Dark cinematic digital illustration, 2:1 wide aspect ratio, 2400x1200.
[SUBJECT DESCRIPTION HERE — e.g. "a regal male character with long crimson
red hair and a dark ornate outfit"] positioned slightly right of center,
face in the upper half of the frame. All four edges of the image fade
smoothly into pure black — heavy dark vignette, so the artwork blends
seamlessly into a black background. The LEFT third is darker atmospheric
space (black smoke, faint embers, deep shadows) reserved for text overlay.
Moody low-key lighting, deep blacks, rich red and gold accents, painterly
anime style. No text, no watermark, no logo. Nothing important near the
edges of the frame.
```

> `[SUBJECT DESCRIPTION HERE]` ko har article ke hisaab se badal do.

## Photoshop/Canva me khud banao to

1. Canvas: 2400 × 1200 px
2. Subject slightly right-of-center, face upper half
3. Charo edges pe black-to-transparent gradient (heavy vignette) — pure black tak fade
4. Left third pe extra dark (black smoke) text ke liye
5. Export: WebP ya JPG, quality 80

## Checklist upload se pehle

- [ ] 2:1 ratio (2400 × 1200)
- [ ] Subject slightly right-of-center, face upper half
- [ ] Chaaro edges pure black me fade
- [ ] Left third dark/khali (text ke liye)
- [ ] < 500 KB
- [ ] Koi text/watermark nahi
