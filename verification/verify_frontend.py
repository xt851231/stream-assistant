from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:3000")
            page.goto("http://localhost:3000", timeout=60000)

            # Wait for App to mount
            print("Waiting for App component...")
            page.wait_for_selector('[data-component="App"]', timeout=30000)

            # Check Stage
            print("Checking for Stage...")
            if page.locator('[data-component="Stage"]').is_visible():
                print("✅ Stage is visible")
            else:
                print("❌ Stage is NOT visible")

            # Check ChatSidebar
            print("Checking for ChatSidebar...")
            if page.locator('[data-component="ChatSidebar"]').is_visible():
                print("✅ ChatSidebar is visible")
            else:
                print("❌ ChatSidebar is NOT visible")

            # Take screenshot
            page.screenshot(path="verification/frontend_check.png")
            print("Screenshot saved to verification/frontend_check.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
