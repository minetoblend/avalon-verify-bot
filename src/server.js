const express = require('express')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const session = require('express-session')
const passport = require('passport')
const OsuStrategy = require('passport-osu').default
const path = require('path')
const dateFns = require('date-fns')


async function runServer(client, MemberModel, VerifyTokenModel) {

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

            const discordProfileId = req.session.discordProfileId

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
        const tokenId = req.query.q

        if (!tokenId) {
            res.status(400).sendFile(path.resolve(__dirname, '../public/invalid-token.html'))
        } else {
            const token = await VerifyTokenModel.findOne({token: tokenId})

            if(!token)
                return res.status(404).sendFile(path.resolve(__dirname, '../public/invalid-token.html'))

            if(dateFns.isAfter(new Date(), token.expiresAt)) {
                return res.status(404).sendFile(path.resolve(__dirname, '../public/expired.html'))
            }

            const guild = await client.guilds.fetch({guild: process.env.DISCORD_GUILD_ID})

            if (!guild)
                return res.sendStatus(404)

            const member = await guild.members.fetch({user: token.discordProfileId})

            if (!member)
                return res.sendStatus(404)

            req.session.discordProfileId = token.discordProfileId

            token.remove()
            next()
        }
    }, passport.authorize('osu'))

    app.get('/avalon/verify/callback', passport.authenticate('osu', {failureRedirect: '/login/error'}), async (req, res) => {
        const user = req.user

        const guild = await client.guilds.fetch({guild: process.env.DISCORD_GUILD_ID})

        if (!guild)
            return res.sendStatus(404)

        const member = await guild.members.fetch({user: user.discordProfileId})

        const role = await guild.roles.fetch('904760669520408628')
        try {
            await member.roles.add(role)
            res.redirect('/avalon/success')
        } catch (e) {
            res.redirect('/avalon/error')
        }
    })

    app.get('/avalon/success', (req, res) => res.sendFile(
        path.resolve(__dirname, '../public/success.html')
    ))

    app.get('/avalon/error', (req, res) => res.status(500).sendFile(
        path.resolve(__dirname, '../public/error.html')
    ))

    app.listen(process.env.PORT || 4040, () => console.log(`Server started listening at port ${process.env.PORT || 4040}`))
}

module.exports = runServer