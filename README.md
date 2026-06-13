# Authbot Discord Bot



## Features

- Guild login - Log in to the bot with your student email to give it access to committee privilages

- Authentication - Allow users to enter their id to check their membership status and automatically give them the member role

- Manual check - Allows committee members to check an id's membership status manually


## Installation

1. Clone the repository:
   ```
   git clone https://github.com/Kay607/AuthBot
   ```

2. Navigate to the project directory:
   ```
   cd Authbot
   ```

3. Install the dependencies:
   ```
   npm install
   ```

4. Setup the tokens:
   Requires a discord bot token in th e `.env` file or as an environment variable.\
   Example env file provided

   An Ngrok token is also required to run the `/guildlogin` command

5. Initialize the database:
   npm run db:push

6. Deploy commands:
   Only required if new commands are added or if you are using a new bot user

   `npm run deploy`

## Usage

Run the bot using:
```
npm start
```

Use the `/addserver` command to add society information to the bot\
`/editserver` can be used to edit this later

`/deletserver` can be used to remove a society from the bot

`/test-id` with an id to check if they are a member

`/test-credentials` to check if the bot currently has committee privilages

`/auth` allows users to verify themselves and get the member role

`/guildlogin` allows committee members to log in to the bot (must be repeated once per week)

`/committee-credentials` allows a committee member to enter their student email, password, and google one time password secret key to auto login once per week as an alternative to `/guildlogin`


## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or features.

## License

This project is licensed under the MIT License.