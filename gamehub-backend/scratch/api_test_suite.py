import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"
AUTH = ("siraj", "admin123")

def test_api():
    print("--- STARTING API FUNCTIONAL TESTS ---")
    ts = int(time.time())
    unique_station = f"TPC-{ts}"
    
    # 1. Test Resource Configuration
    print(f"\n[1] Testing Resource Configuration (Station: {unique_station})...")
    device_data = {
        "name": "Testing PC",
        "prefix": "TPC",
        "count": 10,
        "metadata": {"specs": "RTX 4090"}
    }
    resp = requests.post(f"{BASE_URL}/settings/devices/", json=device_data, auth=AUTH)
    if resp.status_code in [201, 200]:
        print("PASS: Resource created/verified.")
    else:
        print(f"FAIL: {resp.status_code} - {resp.text}")
        return

    # 2. Test Buffet Items
    print("\n[2] Testing Buffet Items...")
    cafe_data = {"name": f"Soda-{ts}", "price": 2.50}
    resp = requests.post(f"{BASE_URL}/settings/cafe-items/", json=cafe_data, auth=AUTH)
    if resp.status_code == 201:
        print("PASS: Created test cafe item.")
    else:
        print(f"FAIL: {resp.status_code} - {resp.text}")

    # 3. Test Session Lifecycle (Postpaid)
    print(f"\n[3] Testing Session Lifecycle (Postpaid on {unique_station})...")
    session_data = {
        "name": "Test Customer",
        "stationId": unique_station,
        "sessionType": "POST",
        "pricePerHour": 5.00
    }
    resp = requests.post(f"{BASE_URL}/sessions/", json=session_data, auth=AUTH)
    if resp.status_code == 201:
        s_id = resp.json()['id']
        print(f"PASS: Session started (ID: {s_id})")
    else:
        print(f"FAIL STARTING: {resp.status_code} - {resp.text}")
        return

    # 4. Test Adding Order to Session
    print("\n[4] Testing Orders & Cost Calculation...")
    order_data = {"name": "Snack", "price": 10.00}
    resp = requests.post(f"{BASE_URL}/sessions/{s_id}/add_order/", json=order_data, auth=AUTH)
    if resp.status_code == 200:
        cost = resp.json()['totalCost']
        print(f"PASS: Order added. Current cost: ${cost}")
    else:
        print(f"FAIL Adding Order: {resp.text}")

    # 5. Test Pause Logic
    print("\n[5] Testing Pause/Resume...")
    resp = requests.post(f"{BASE_URL}/sessions/{s_id}/pause/", auth=AUTH)
    if resp.status_code == 200 and resp.json()['isPaused']:
        print("PASS: Session paused.")
        time.sleep(1)
        resp = requests.post(f"{BASE_URL}/sessions/{s_id}/pause/", auth=AUTH)
        if resp.status_code == 200 and not resp.json()['isPaused']:
            print(f"PASS: Session resumed. Paused MS: {resp.json()['totalPausedMs']}")
        else:
            print("FAIL: Failed to resume.")
    else:
        print("FAIL: Failed to pause.")

    # 6. Test Ending Session
    print("\n[6] Testing Session Ending...")
    resp = requests.post(f"{BASE_URL}/sessions/{s_id}/end/", json={"discount": 2.00}, auth=AUTH)
    if resp.status_code == 200:
        final_data = resp.json()
        print(f"PASS: Session ended. Total: ${final_data['totalCost']}")
    else:
        print(f"FAIL Ending: {resp.text}")

    # 7. Test Lazy Auto-End
    print("\n[7] Testing Lazy Auto-End (Prepaid)...")
    unique_pre_station = f"PRE-{ts}"
    pre_data = {
        "name": "Prepaid User",
        "stationId": unique_pre_station,
        "sessionType": "PRE",
        "pricePerHour": 5000.00, # High price to ensure duration is small, or just durationHours
        "durationHours": 0.0001
    }
    resp = requests.post(f"{BASE_URL}/sessions/", json=pre_data, auth=AUTH)
    if resp.status_code == 201:
        pre_id = resp.json()['id']
        print("PASS: Prepaid session started. Waiting 2s for auto-end...")
        time.sleep(2)
        resp = requests.get(f"{BASE_URL}/sessions/", auth=AUTH)
        sessions = resp.json()
        target = next((s for s in sessions if s['id'] == pre_id), None)
        if target and target['endTime']:
            print(f"PASS: Session auto-ended successfully at {target['endTime']}")
        else:
            print("FAIL: Session did not auto-end.")

    print("\n--- ALL TESTS COMPLETED ---")

if __name__ == "__main__":
    test_api()
