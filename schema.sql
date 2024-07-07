create table user_account (
    id varchar(36) primary key,
    email varchar(255) not null,
    first_name varchar(30) not null,
    last_name varchar(30) not null,
    hashed_password text not null,
    password_salt varchar(22) not null,
    created_at timestamp not null default current_timestamp,
    account_barrier timestamp not null default current_timestamp
);

create table rsa_key (
    id varchar(36) primary key,
    public_key text not null,
    private_key text not null,
    created_at timestamp not null default current_timestamp
);

create table email_type (
    id varchar(10) primary key,
);

create table mail_inbox (
    id varchar(36) primary key,
    email_type varchar(10) not null,
    content text not null,
    created_at timestamp not null default current_timestamp,
);