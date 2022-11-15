# apollusia

Apollusia is a calendar tool for coordinating events with multiple people.
It is a web application written in Angular with NestJS as the backend.

:star: Star this project on GitHub — it motivates me a lot!

<!---
TODO: Add Logo Banner
-->

<!---
TODO: Add screenshots of the application
-->

## Table of Contents

- [Setup](#setup)

## Setup

<sup>[(Back to top)](#table-of-contents)</sup>

Create an `.env` file in the backend directory and add the following environment variables:

```bash
EMAIL_HOST=<smtp host>
EMAIL_PORT=25 # optional, alternatively 587, or 465 for SSL
EMAIL_SSL=false # optional
EMAIL_STARTTLS=false # optional
EMAIL_USER=<username>
EMAIL_PASSWORD=<password>
EMAIL_FROM=<sender email>
EMAIL_NAME=Apollusia # optional sender display name
```
