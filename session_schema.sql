PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

create table user_session (
    sid primary key,
    expired,
    sess
);