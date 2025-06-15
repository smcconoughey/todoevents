#!/usr/bin/env python3
"""
Test script for Enterprise Dashboard functionality
Tests the new enterprise endpoints and database schema
"""

import requests
import json
import os
from datetime import datetime

# Configuration
API_BASE = os.getenv("API_BASE", "http://localhost:8000")
TEST_EMAIL = "enterprise-test@todo-events.com"
TEST_PASSWORD = "EnterpriseTest123!"

class EnterpriseEndpointTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        
    def authenticate(self):
        """Authenticate as an enterprise user"""
        print("🔐 Testing Enterprise Authentication...")
        
        # Login
        login_data = {
            "username": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
        
        try:
            response = self.session.post(f"{API_BASE}/token", data=login_data)
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                print("✅ Authentication successful")
                
                # Verify enterprise role
                user_response = self.session.get(f"{API_BASE}/users/me")
                if user_response.status_code == 200:
                    user_data = user_response.json()
                    print(f"👤 User: {user_data['email']}, Role: {user_data['role']}")
                    
                    if user_data["role"] in ["enterprise", "admin"]:
                        self.user_id = user_data["id"]
                        print("✅ Enterprise access verified")
                        return True
                    else:
                        print(f"❌ Invalid role: {user_data['role']} (need 'enterprise' or 'admin')")
                        return False
                else:
                    print(f"❌ Failed to get user details: {user_response.status_code}")
                    return False
            else:
                print(f"❌ Authentication failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def test_overview_endpoint(self):
        """Test the enterprise overview endpoint"""
        print("\n📊 Testing Enterprise Overview...")
        
        try:
            response = self.session.get(f"{API_BASE}/enterprise/overview")
            if response.status_code == 200:
                data = response.json()
                print("✅ Overview endpoint working")
                print(f"   📊 Total events: {data.get('total_events', 0)}")
                print(f"   🏢 Total clients: {data.get('total_clients', 0)}")
                print(f"   👁️  Total views: {data.get('total_views', 0)}")
                return True
            else:
                print(f"❌ Overview failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Overview error: {e}")
            return False
    
    def test_clients_endpoint(self):
        """Test the enterprise clients endpoint"""
        print("\n🏢 Testing Enterprise Clients...")
        
        try:
            response = self.session.get(f"{API_BASE}/enterprise/clients")
            if response.status_code == 200:
                data = response.json()
                clients = data.get("clients", [])
                print("✅ Clients endpoint working")
                print(f"   🏢 Found {len(clients)} clients")
                for client in clients[:3]:  # Show first 3 clients
                    print(f"   - {client['client_name']}: {client['total_events']} events")
                return True
            else:
                print(f"❌ Clients failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Clients error: {e}")
            return False
    
    def test_events_endpoint(self):
        """Test the enterprise events endpoint with filtering"""
        print("\n📅 Testing Enterprise Events...")
        
        try:
            # Test basic events list
            response = self.session.get(f"{API_BASE}/enterprise/events?page=1&limit=10")
            if response.status_code == 200:
                data = response.json()
                events = data.get("events", [])
                print("✅ Events endpoint working")
                print(f"   📅 Found {data.get('total_count', 0)} total events")
                print(f"   📄 Page {data.get('page', 1)} of {data.get('total_pages', 1)}")
                
                # Test with client filter if we have clients
                if events and any(event.get("client_name") for event in events):
                    client_name = next((event["client_name"] for event in events if event.get("client_name")), None)
                    if client_name:
                        filtered_response = self.session.get(f"{API_BASE}/enterprise/events?client_filter={client_name}")
                        if filtered_response.status_code == 200:
                            filtered_data = filtered_response.json()
                            print(f"   🔍 Client filter '{client_name}': {len(filtered_data.get('events', []))} events")
                
                return True
            else:
                print(f"❌ Events failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Events error: {e}")
            return False
    
    def test_analytics_endpoint(self):
        """Test the enterprise analytics endpoint"""
        print("\n📈 Testing Enterprise Analytics...")
        
        try:
            response = self.session.get(f"{API_BASE}/enterprise/analytics/clients")
            if response.status_code == 200:
                data = response.json()
                client_analytics = data.get("client_analytics", [])
                trends = data.get("trends", [])
                print("✅ Analytics endpoint working")
                print(f"   📈 Client analytics: {len(client_analytics)} clients")
                print(f"   📊 Trends data: {len(trends)} data points")
                
                if client_analytics:
                    top_client = max(client_analytics, key=lambda x: x.get("total_events", 0))
                    print(f"   🏆 Top client: {top_client['client_name']} ({top_client['total_events']} events)")
                
                return True
            else:
                print(f"❌ Analytics failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Analytics error: {e}")
            return False
    
    def test_bulk_import(self):
        """Test the enterprise bulk import functionality"""
        print("\n📤 Testing Enterprise Bulk Import...")
        
        # Sample test event data with client_name
        test_events = {
            "events": [
                {
                    "title": "Test Enterprise Event",
                    "description": "A test event for enterprise dashboard",
                    "date": "2024-12-31",
                    "start_time": "14:00",
                    "category": "business",
                    "address": "Test Location, Test City, TC, USA",
                    "lat": 40.7128,
                    "lng": -74.0060,
                    "client_name": "Test Client Corp",
                    "host_name": "Test Enterprise Team",
                    "fee_required": "Free test event"
                }
            ]
        }
        
        try:
            response = self.session.post(
                f"{API_BASE}/enterprise/events/bulk-import",
                json=test_events
            )
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Bulk import endpoint working")
                print(f"   ✅ Success count: {data.get('success_count', 0)}")
                print(f"   ❌ Error count: {data.get('error_count', 0)}")
                
                if data.get("errors"):
                    print("   🚨 Import errors:")
                    for error in data["errors"][:3]:  # Show first 3 errors
                        print(f"     - Event {error.get('index', 'N/A')}: {error.get('error', 'Unknown error')}")
                
                return data.get('success_count', 0) > 0
            else:
                print(f"❌ Bulk import failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Bulk import error: {e}")
            return False
    
    def test_export_functionality(self):
        """Test the enterprise export functionality"""
        print("\n📥 Testing Enterprise Export...")
        
        try:
            # Test CSV export
            response = self.session.get(f"{API_BASE}/enterprise/events/export?format=csv")
            if response.status_code == 200:
                print("✅ CSV export working")
                print(f"   📄 Content type: {response.headers.get('content-type', 'unknown')}")
                print(f"   📏 Content length: {len(response.content)} bytes")
            else:
                print(f"❌ CSV export failed: {response.status_code}")
                return False
            
            # Test JSON export
            response = self.session.get(f"{API_BASE}/enterprise/events/export?format=json")
            if response.status_code == 200:
                data = response.json()
                events = data.get("events", [])
                print("✅ JSON export working")
                print(f"   📊 Exported {len(events)} events")
                return True
            else:
                print(f"❌ JSON export failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Export error: {e}")
            return False
    
    def test_database_schema(self):
        """Test that the client_name field exists in the database"""
        print("\n🗄️  Testing Database Schema...")
        
        try:
            # Try to create an event with client_name through the regular API
            test_event = {
                "title": "Schema Test Event",
                "description": "Testing client_name field in database",
                "date": "2024-12-25",
                "start_time": "10:00",
                "category": "test",
                "address": "Schema Test Location",
                "lat": 40.7128,
                "lng": -74.0060,
                "client_name": "Schema Test Client"
            }
            
            response = self.session.post(f"{API_BASE}/events", json=test_event)
            if response.status_code == 200:
                event_data = response.json()
                event_id = event_data.get("id")
                print("✅ Event creation with client_name successful")
                print(f"   🆔 Event ID: {event_id}")
                
                # Try to retrieve the event and verify client_name is stored
                get_response = self.session.get(f"{API_BASE}/events/{event_id}")
                if get_response.status_code == 200:
                    retrieved_event = get_response.json()
                    stored_client = retrieved_event.get("client_name")
                    if stored_client == test_event["client_name"]:
                        print(f"✅ Client name stored correctly: '{stored_client}'")
                        return True
                    else:
                        print(f"❌ Client name mismatch: expected '{test_event['client_name']}', got '{stored_client}'")
                        return False
                else:
                    print(f"❌ Failed to retrieve created event: {get_response.status_code}")
                    return False
            else:
                print(f"❌ Event creation failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Database schema error: {e}")
            return False
    
    def run_all_tests(self):
        """Run all enterprise dashboard tests"""
        print("🚀 Starting Enterprise Dashboard Test Suite")
        print("=" * 50)
        
        if not self.authenticate():
            print("\n❌ Authentication failed - cannot continue with tests")
            return False
        
        tests = [
            ("Database Schema", self.test_database_schema),
            ("Overview Endpoint", self.test_overview_endpoint),
            ("Clients Endpoint", self.test_clients_endpoint),
            ("Events Endpoint", self.test_events_endpoint),
            ("Analytics Endpoint", self.test_analytics_endpoint),
            ("Bulk Import", self.test_bulk_import),
            ("Export Functionality", self.test_export_functionality),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} crashed: {e}")
                results.append((test_name, False))
        
        # Print summary
        print("\n" + "=" * 50)
        print("📋 Test Results Summary")
        print("=" * 50)
        
        passed = 0
        failed = 0
        
        for test_name, result in results:
            if result:
                print(f"✅ {test_name}")
                passed += 1
            else:
                print(f"❌ {test_name}")
                failed += 1
        
        print(f"\n📊 Total: {passed + failed} tests")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if failed == 0:
            print("\n🎉 All tests passed! Enterprise dashboard is working correctly.")
        else:
            print(f"\n⚠️ {failed} test(s) failed. Please check the implementation.")
        
        return failed == 0

def main():
    """Main test runner"""
    print(f"🔧 Testing against API: {API_BASE}")
    print(f"👤 Test user: {TEST_EMAIL}")
    print()
    
    tester = EnterpriseEndpointTester()
    success = tester.run_all_tests()
    
    if success:
        exit(0)
    else:
        exit(1)

if __name__ == "__main__":
    main()