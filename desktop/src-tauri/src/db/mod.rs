use std::path::Path;
use std::sync::Mutex;

use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;

use crate::error::{AppError, AppResult};
use crate::models::{NewRecording, Recording};

diesel::table! {
    recordings (id) {
        id -> BigInt,
        name -> Text,
        file_path -> Text,
        thumbnail_path -> Nullable<Text>,
        mime_type -> Text,
        duration -> BigInt,
        size -> BigInt,
        created_at -> Text,
    }
}

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = recordings, check_for_backend(diesel::sqlite::Sqlite))]
struct RecordingRow {
    id: i64,
    name: String,
    file_path: String,
    thumbnail_path: Option<String>,
    mime_type: String,
    duration: i64,
    size: i64,
    created_at: String,
}

impl From<RecordingRow> for Recording {
    fn from(row: RecordingRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            file_path: row.file_path,
            thumbnail_path: row.thumbnail_path,
            mime_type: row.mime_type,
            duration: row.duration,
            size: row.size,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, Insertable)]
#[diesel(table_name = recordings, check_for_backend(diesel::sqlite::Sqlite))]
struct NewRecordingRow<'a> {
    name: &'a str,
    file_path: &'a str,
    thumbnail_path: Option<&'a str>,
    mime_type: &'a str,
    duration: i64,
    size: i64,
    created_at: &'a str,
}

pub struct Database {
    conn: Mutex<SqliteConnection>,
}

impl Database {
    pub fn open(db_path: &Path) -> AppResult<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = SqliteConnection::establish(&db_path.to_string_lossy())?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> AppResult<Self> {
        let conn = SqliteConnection::establish(":memory:")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> AppResult<()> {
        let mut conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        conn.batch_execute(
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
        let mut conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        let new_row = NewRecordingRow {
            name: &rec.name,
            file_path: &rec.file_path,
            thumbnail_path: rec.thumbnail_path.as_deref(),
            mime_type: &rec.mime_type,
            duration: rec.duration,
            size: rec.size,
            created_at: &rec.created_at,
        };
        let row: RecordingRow = diesel::insert_into(recordings::table)
            .values(&new_row)
            .returning(RecordingRow::as_returning())
            .get_result(&mut *conn)?;
        Ok(row.into())
    }

    pub fn get_all_recordings(&self) -> AppResult<Vec<Recording>> {
        let mut conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        let rows: Vec<RecordingRow> = recordings::table
            .select(RecordingRow::as_select())
            .order((recordings::created_at.desc(), recordings::id.desc()))
            .load(&mut *conn)?;
        Ok(rows.into_iter().map(Into::into).collect())
    }

    pub fn get_recording_by_id(&self, target_id: i64) -> AppResult<Recording> {
        let mut conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        let row = recordings::table
            .filter(recordings::id.eq(target_id))
            .select(RecordingRow::as_select())
            .first(&mut *conn)
            .optional()?
            .ok_or_else(|| AppError::NotFound(format!("Recording {target_id} not found")))?;
        Ok(row.into())
    }

    pub fn update_recording_name(&self, target_id: i64, new_name: &str) -> AppResult<()> {
        let mut conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        let affected = diesel::update(recordings::table.filter(recordings::id.eq(target_id)))
            .set(recordings::name.eq(new_name))
            .execute(&mut *conn)?;
        if affected == 0 {
            return Err(AppError::NotFound(format!(
                "Recording {target_id} not found"
            )));
        }
        Ok(())
    }

    pub fn delete_recording(&self, target_id: i64) -> AppResult<Recording> {
        let existing = self.get_recording_by_id(target_id)?;
        let mut conn = self.conn.lock().map_err(|e| {
            AppError::Recording(format!("Failed to lock database connection: {e}"))
        })?;
        diesel::delete(recordings::table.filter(recordings::id.eq(target_id)))
            .execute(&mut *conn)?;
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

        db.update_recording_name(saved.id, "Renamed")
            .expect("rename");
        let updated = db.get_recording_by_id(saved.id).expect("get by id");
        assert_eq!(updated.name, "Renamed");

        let deleted = db.delete_recording(saved.id).expect("delete");
        assert_eq!(deleted.id, saved.id);
        assert!(db
            .get_all_recordings()
            .expect("get all after delete")
            .is_empty());
    }
}
