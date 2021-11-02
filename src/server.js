const express = require('express')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const session = require('express-session')
const passport = require('passport')
const OsuStrategy = require('passport-osu').default
const path = require('path')


async function runServer(client, MemberModel) {

    const app = express()

    app.use(cookieParser())
    app.use(bodyParser.json())
    app.use(session({secret: process.env.SESSION_SECRET}))
    app.use(passport.initialize())
    app.use(passport.session())

    passport.use(new OsuStrategy({
            type: 'StrategyOptionsWithRequest',
            clientID: process.env.OSU_CLIENT_ID,
            clientSecret: process.env.OSU_CLIENT_SECRET,
            callbackURL: process.env.OSU_CLIENT_CALLBACK,
            passReqToCallback: true,
            scope: ['identify']
        }, async (req, accessToken, refreshToken, profile, done) => {

            const discordProfileId = req.session.discordUserId

            if(!discordProfileId) {
                done(new Error('no user id set', null))
                return
            }

            const user = await (MemberModel.findOne({profileId: profile.id}))

            if (user) {
                console.log(user.discordProfileId,)
                if (user.discordProfileId !== discordProfileId) {
                    done(new Error('osu profile already linked with different discord user'))
                    return
                }

                done(null, user)
            } else {
                const newUser = new MemberModel({
                    displayName: profile.displayName,
                    profileId: profile.id,
                    discordProfileId
                })

                await newUser.save()

                done(null, newUser)
            }
        })
    )

    passport.serializeUser((user, done) => {
        done(null, user.profileId);
    });

    passport.deserializeUser(async (id, done) => {
        const user = await MemberModel.findOne({profileId: id})
        done(null, user.profileId);
    });

    app.get('/avalon/verify', async (req, res, next) => {
        const discordUserId = req.query.q

        console.log('/verify')

        if (!discordUserId) {
            res.sendStatus(400)
        } else {
            const guild = await client.guilds.fetch({guild: process.env.DISCORD_GUILD_ID})

            if (!guild)
                return res.sendStatus(404)

            const member = await guild.members.fetch({user: discordUserId})

            if (!member)
                return res.sendStatus(404)

            req.session.discordUserId = discordUserId
            next()
        }
    }, passport.authorize('osu'))

    app.get('/avalon/verify/callback', passport.authenticate('osu', {failureRedirect: '/login/error'}), async (req, res) => {
        const user = req.user

        const guild = await client.guilds.fetch({guild: process.env.DISCORD_GUILD_ID})

        if (!guild)
            return res.sendStatus(404)

        const member = await guild.members.fetch({user: user.discordProfileId})
        console.log(member)

        const role = await guild.roles.fetch('904760669520408628')
        try {
            console.log(role)
            await member.roles.add(role)
            res.redirect('/avalon/success')
        } catch (e) {
            res.redirect('/login/error')
        }
    })

    app.get('/avalon/success', (req, res) => res.sendFile(
        path.resolve(__dirname, '../public/success.html')
    ))

    app.listen(process.env.PORT || 4040, () => console.log(`Server started listening at port ${process.env.PORT || 4040}`))
}

module.exports = runServer