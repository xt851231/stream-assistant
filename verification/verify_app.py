from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:3000")
            page.goto("http://localhost:3000")

            # Wait for the app to load (look for "STREAM QUEST" text)
            print("Waiting for app to load...")
            page.wait_for_selector("text=STREAM QUEST")

            # Wait a bit for animations/effects
            page.wait_for_timeout(2000)

            print("Taking screenshot...")
            page.screenshot(path="verification/app_screenshot.png")
            print("Screenshot saved to verification/app_screenshot.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_screenshot.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
