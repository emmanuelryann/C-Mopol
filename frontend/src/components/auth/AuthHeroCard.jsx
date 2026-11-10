import React, { useState, useEffect } from 'react';

const HERO_SLIDES = [
  {
    id: 1,
    headline: 'Discover your next journey',
    description:
      'Explore ideas, stories, and experiences designed to inspire your everyday life, guiding you through meaningful moments and fresh insights every day.',
    bgGradient:
      'radial-gradient(ellipse at 50% 60%, rgba(30, 60, 90, 0.85) 0%, rgba(10, 20, 30, 0.95) 70%), linear-gradient(180deg, #1A2E3B 0%, #0D161C 100%)',
    imageKeyword: 'nature,surreal,mirror,horizon',
  },
  {
    id: 2,
    headline: 'Find meaning in every moment',
    description:
      'Thoughtfully curated experiences to help you pause, reflect, and explore designed to bring clarity, inspiration, and meaning to your everyday moments.',
    bgGradient:
      'radial-gradient(ellipse at 50% 40%, rgba(60, 45, 30, 0.8) 0%, rgba(15, 12, 10, 0.95) 80%), linear-gradient(180deg, #2B2119 0%, #0F0D0B 100%)',
    imageKeyword: 'portrait,goggles,reflection',
  },
  {
    id: 3,
    headline: 'Curated for the modern explorer',
    description:
      'Elevated goods, seamless digital commerce, and effortless security engineered for your everyday journey.',
    bgGradient:
      'radial-gradient(ellipse at 50% 50%, rgba(35, 55, 45, 0.8) 0%, rgba(10, 20, 15, 0.95) 80%), linear-gradient(180deg, #1B2922 0%, #0B120E 100%)',
    imageKeyword: 'minimalist,architecture,modern',
  },
  {
    id: 4,
    headline: 'Security crafted with care',
    description:
      'Multi-device session controls, cryptographic verification, and frictionless authentication at every step.',
    bgGradient:
      'radial-gradient(ellipse at 50% 50%, rgba(45, 35, 60, 0.8) 0%, rgba(15, 10, 20, 0.95) 80%), linear-gradient(180deg, #231C2E 0%, #0E0B12 100%)',
    imageKeyword: 'cyber,protection,abstract',
  },
];

export const AuthHeroCard = ({ initialSlideIndex = 0 }) => {
  const [currentSlide, setCurrentSlide] = useState(initialSlideIndex);

  useEffect(() => {
    setCurrentSlide(initialSlideIndex);
  }, [initialSlideIndex]);

  // Subtle auto-advance every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const slide = HERO_SLIDES[currentSlide] || HERO_SLIDES[0];

  return (
    <aside className="auth-hero-card" aria-label="Visual showcase">
      <div
        className="hero-background-art"
        style={{
          background: slide.bgGradient,
        }}
      >
        {/* Artistic overlay atmosphere */}
        <div className="hero-art-glow" />
      </div>

      <div className="hero-content-wrapper">
        {/* Carousel indicator dashes */}
        <div className="hero-carousel-indicators" role="tablist" aria-label="Slide indicators">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`indicator-dash ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              role="tab"
              aria-selected={index === currentSlide}
            />
          ))}
        </div>

        {/* Narrative text matching screenshot typography */}
        <div className="hero-narrative">
          <h2 className="hero-headline">{slide.headline}</h2>
          <p className="hero-description">{slide.description}</p>
        </div>
      </div>
    </aside>
  );
};

export default AuthHeroCard;
