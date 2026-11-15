use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection};

use crate::error::{AppError, AppResult};
use crate::models::{NewRecording, Recording};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(db_path: &Path) -> AppResult<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS recordings (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               name TEXT NOT NULL,
               file_path TEXT NOT NULL,
               thumbnail_path TEXT,
               mime_type TEXT NOT NULL,
               duration INTEGER NOT NULL,
               size INTEGER NOT NULL,
               created_at TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);",
        )?;
        Ok(())
    }

    pub fn save_recording(&self, rec: &NewRecording) -> AppResult<Recording> {
        let conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        conn.execute(
            "INSERT INTO recordings (name, file_path, thumbnail_path, mime_type, duration, size, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                rec.name,
                rec.file_path,
                rec.thumbnail_path,
                rec.mime_type,
                rec.duration,
                rec.size,
                rec.created_at,
            ],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Recording {
            id,
            name: rec.name.clone(),
            file_path: rec.file_path.clone(),
            thumbnail_path: rec.thumbnail_path.clone(),
            mime_type: rec.mime_type.clone(),
            duration: rec.duration,
            size: rec.size,
            created_at: rec.created_at.clone(),
        })
    }

    pub fn get_all_recordings(&self) -> AppResult<Vec<Recording>> {
        let conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        let mut stmt = conn.prepare(
            "SELECT id, name, file_path, thumbnail_path, mime_type, duration, size, created_at
             FROM recordings
             ORDER BY created_at DESC, id DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Recording {
                id: row.get(0)?,
                name: row.get(1)?,
                file_path: row.get(2)?,
                thumbnail_path: row.get(3)?,
                mime_type: row.get(4)?,
                duration: row.get(5)?,
                size: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        let mut recordings = Vec::new();
        for row in rows {
            recordings.push(row?);
        }
        Ok(recordings)
    }

    pub fn get_recording_by_id(&self, id: i64) -> AppResult<Recording> {
        let conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        conn.query_row(
            "SELECT id, name, file_path, thumbnail_path, mime_type, duration, size, created_at
             FROM recordings WHERE id = ?1",
            params![id],
            |row| {
                Ok(Recording {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    file_path: row.get(2)?,
                    thumbnail_path: row.get(3)?,
                    mime_type: row.get(4)?,
                    duration: row.get(5)?,
                    size: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::NotFound(format!("Recording {id} not found"))
            }
            other => AppError::Database(other),
        })
    }

    pub fn update_recording_name(&self, id: i64, name: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        let affected = conn.execute(
            "UPDATE recordings SET name = ?1 WHERE id = ?2",
            params![name, id],
        )?;
        if affected == 0 {
            return Err(AppError::NotFound(format!("Recording {id} not found")));
        }
        Ok(())
    }

    pub fn delete_recording(&self, id: i64) -> AppResult<Recording> {
        let existing = self.get_recording_by_id(id)?;
        let conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        conn.execute("DELETE FROM recordings WHERE id = ?1", params![id])?;
        Ok(existing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crud_recordings() {
        let db = Database::open_in_memory().expect("open in-memory db");
        let saved = db
            .save_recording(&NewRecording {
                name: "Test Recording".into(),
                file_path: "/tmp/test.mp4".into(),
                thumbnail_path: Some("/tmp/test.jpg".into()),
                mime_type: "video/mp4".into(),
                duration: 5000,
                size: 102400,
                created_at: "2026-11-16T00:00:00Z".into(),
            })
            .expect("save recording");

        assert_eq!(saved.id, 1);
        assert_eq!(saved.name, "Test Recording");

        let all = db.get_all_recordings().expect("get all");
        assert_eq!(all.len(), 1);

        db.update_recording_name(saved.id, "Renamed").expect("rename");
        let updated = db.get_recording_by_id(saved.id).expect("get by id");
        assert_eq!(updated.name, "Renamed");

        let deleted = db.delete_recording(saved.id).expect("delete");
        assert_eq!(deleted.id, saved.id);
        assert!(db.get_all_recordings().expect("get all after delete").is_empty());
    }
}
