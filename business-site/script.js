// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileToggle = document.querySelector('.nav-mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', function() {
            navLinks.classList.toggle('nav-links-mobile');
            mobileToggle.classList.toggle('active');
        });
    }

    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed nav
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
                
                // Close mobile nav if open
                if (navLinks.classList.contains('nav-links-mobile')) {
                    navLinks.classList.remove('nav-links-mobile');
                    mobileToggle.classList.remove('active');
                }
            }
        });
    });

    // Contact form enhancement
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            // Form validation
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;
            
            if (!subject || !message) {
                e.preventDefault();
                alert('Please fill in all required fields.');
                return;
            }
            
            // Enhance mailto with organization if provided
            const organization = document.getElementById('organization').value;
            if (organization) {
                const bodyText = `Organization: ${organization}\n\n${message}`;
                document.getElementById('message').name = 'body';
                document.getElementById('message').value = bodyText;
            }
        });
    }

    // Navbar background on scroll
    const nav = document.querySelector('.nav');
    if (nav) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                nav.classList.add('nav-scrolled');
            } else {
                nav.classList.remove('nav-scrolled');
            }
        });
    }

    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe all animatable elements
    const animateElements = document.querySelectorAll('.product-card, .enterprise-feature, .value, .contact-method');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // Stats counter animation
    const statsNumbers = document.querySelectorAll('.stat-number');
    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const text = element.textContent;
                
                // Only animate numbers
                if (text.includes('50K+')) {
                    animateCounter(element, 0, 50000, 2000, 'K+');
                }
            }
        });
    }, observerOptions);

    statsNumbers.forEach(stat => {
        statsObserver.observe(stat);
    });

    function animateCounter(element, start, end, duration, suffix = '') {
        const startTime = performance.now();
        
        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = Math.floor(start + (end - start) * easeOutQuart(progress));
            
            if (suffix === 'K+') {
                element.textContent = Math.floor(current / 1000) + 'K+';
            } else {
                element.textContent = current + suffix;
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }
        
        requestAnimationFrame(updateCounter);
    }

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    // Product card interactions
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // External link tracking (for analytics)
    const externalLinks = document.querySelectorAll('a[href^="https://todo-events.com"], a[href^="mailto:"]');
    externalLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Track clicks for analytics if needed
            console.log('External link clicked:', this.href);
        });
    });

    // Keyboard navigation support
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close mobile nav on escape
            if (navLinks && navLinks.classList.contains('nav-links-mobile')) {
                navLinks.classList.remove('nav-links-mobile');
                mobileToggle.classList.remove('active');
            }
        }
    });

    // Prevent form resubmission on page refresh
    if (window.history.replaceState) {
        window.history.replaceState(null, null, window.location.href);
    }
});

// Add CSS for mobile navigation
const mobileNavCSS = `
.nav-links-mobile {
    display: flex !important;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    flex-direction: column;
    padding: 1rem 20px;
    gap: 1rem;
}

.nav-mobile-toggle.active span:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
}

.nav-mobile-toggle.active span:nth-child(2) {
    opacity: 0;
}

.nav-mobile-toggle.active span:nth-child(3) {
    transform: rotate(-45deg) translate(7px, -6px);
}

.nav-scrolled {
    background: rgba(255, 255, 255, 0.98) !important;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}

.animate-in {
    animation: fadeInUp 0.6s ease-out;
}

@media (max-width: 768px) {
    .nav-links {
        display: none;
    }
}
`;

// Inject mobile navigation CSS
const style = document.createElement('style');
style.textContent = mobileNavCSS;
document.head.appendChild(style);