PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

create table user_account (
    id varchar(36) primary key,
    email varchar(255) not null unique,
    first_name varchar(30) not null,
    last_name varchar(30) not null,
    hashed_password text not null,
    password_salt varchar(22) not null,
    created_at timestamptz not null default current_timestamp,
    user_role varchar(3) not null check (user_role = 'adm' or user_role = 'usr') default 'usr',
    account_barrier timestamptz not null default current_timestamp,
    unique (id, user_role)
);

create table user_customer (
    user_id varchar(36) primary key references user_account(id),
    user_role varchar(3) not null check (user_role = 'usr') default 'usr',
    foreign key (user_id, user_role) references user_account(id, user_role),
    unique (user_id, user_role)
);

create table user_admin (
    user_id varchar(36) primary key references user_account(id),
    user_role varchar(3) not null check (user_role = 'adm') default 'adm',
    foreign key (user_id, user_role) references user_account(id, user_role),
    unique (user_id, user_role)
);

create table rsa_key (
    id varchar(36) primary key,
    public_key text not null,
    private_key text not null,
    created_at timestamp not null default current_timestamp
);

create table email_type (
    id varchar(10) primary key
);

create table email_inbox (
    id varchar(36) primary key,
    email_type varchar(10) not null references email_type(id),
    content text not null,
    created_at timestamp not null default current_timestamp
);

create table vote_page (
    id varchar(36) primary key,
    vote_type varchar(6) not null check (vote_type = 'anymus' or vote_type = 'public'),
    vote_description text not null,
    title text not null,
    created_at timestamp not null default current_timestamp,
    created_by varchar(36) not null references user_customer(user_id),
    available boolean not null default true,
    option_type varchar(6) not null check (option_type = 'single' or option_type = 'multiple') default 'single',
    compile_start_at timestamp not null,
    compile_end_at timestamp not null,

    /* A json object with the filter restrictions imposed on the vote */
    restrict_filter jsonb not null default '{}',
    unique (id, option_type)
);

create table vote_option (
    option_index smallint not null,
    vote_page_id varchar(36) not null references vote_page(id),
    option_text text not null,
    created_at timestamp not null default current_timestamp,
    primary key (option_index, vote_page_id),
    check (option_index >= 0),
    unique (option_index, vote_page_id)
);

create table vote (
    vote_page_id varchar(36) not null references vote_page(id),
    vote_type varchar(6) not null,
    vote_option_index smallint not null,
    created_at timestamp not null default current_timestamp,

    /* This check constraint is to ensure that the voter is hidden if the vote is anymus */
    created_by varchar(36) null references user_customer(user_id),
    check ((created_by is null and vote_type = 'anymus') or (created_by is not null and vote_type = 'public')),
    
    check (vote_option_index >= 0),
    primary key (vote_page_id, created_by, vote_option_index),
    foreign key (vote_page_id, vote_option_index) references vote_option(option_index, vote_page_id),
    foreign key (vote_page_id, vote_type) references vote_page(id, option_type) on delete no action
);

/* This table is required to be able to check if a user has voted on a specific poll */
/* Dropping this table and adding a new column with a random value in table vote to group a set of answers for each user would also solve the problem */
/* but make it impossible to know who voted for an anonyous poll. Hence, a user may vote multiple times for an anonymous poll */
create table voter (
    vote_page_id varchar(36) not null references vote_page(id),
    voter_id varchar(36) not null references user_account(id),
    created_at timestamp not null default current_timestamp,
    primary key (vote_page_id, voter_id)
);