# aiot_fresh/create_user.py
import sqlite3
import bcrypt
import getpass
import os

# This script will clear the users table and create a new user.
# Ideal for resetting credentials in a development environment.

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "aiot.db")

def main():
    """
    Clears the users table and creates a single new user.
    """
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        print("Please run `python3 init_db.py` first.")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 1. Clear the entire users table
        cursor.execute("DELETE FROM users;")
        print("Cleared all existing users from the 'users' table.")

        # 2. Get new user details
        username = input("Enter new username: ")
        password = getpass.getpass("Enter new password: ")
        
        if not username or not password:
            print("Username and password cannot be empty.")
            return

        # 3. Hash the password and insert the new user
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hashed_password.decode('utf-8'))
        )
        
        conn.commit()
        print(f"Successfully created user '{username}'.")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
