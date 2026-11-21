# habbitTracker
# habb
# habb
# habb

## SEO metadata

Each HTML page includes a page-specific description and TheBenzzCreations author and creator metadata. The public landing page (`index.html`) also includes Open Graph and Twitter metadata, one WebSite JSON-LD block identifying the creator, and a visible developer credit in its existing footer.

Existing page titles, HabitTracker branding, navigation and application behavior are preserved. The footer credit uses a normal same-tab hyperlink for the developer link.

Production identity is recorded in `seo-sites.json`; see Canonical URL validation below. The developer credit is not evidence of a project deployment URL.

The supplied nginx configuration serves `login.html` before `index.html` at the root. The public landing page and its footer credit remain at `/index.html`; this change does not alter that routing.

## Development & Maintenance

**Developed & Maintained by
[Khushal Sehrawat](https://github.com/khushalsehrawat)**
— Founder of
[TheBenzzCreations](https://www.thebenzzcreations.com/).

TheBenzzCreations is a digital development studio specializing in website development, custom software, mobile applications, e-commerce solutions and AI-powered business automation.

For development enquiries and collaborations, visit [TheBenzzCreations](https://www.thebenzzcreations.com/).

## Canonical URL validation

Run `python scripts/validate_seo.py` from this repository before publishing. The dependency-free check validates exact page canonicals, Open Graph URLs, website/application JSON-LD URLs, sitemap locations, robots sitemap references and literal framework site metadata against `seo-sites.json`. It checks deployment path prefixes as well as domains, so one GitHub Pages project cannot canonicalize to another.

Only URLs whose live HTML matched the local page on 2026-11-21 are configured. Unverified pages have no canonical or social URL; `python scripts/validate_seo.py --require-verified` also fails for those pending pages. Reverify the configuration if the deployment moves. Dynamic framework expressions still require runtime validation.

TheBenzzCreations attribution, creator organization URLs and existing normal same-tab developer credit links are preserved. These outbound attribution links are separate from site identity.
